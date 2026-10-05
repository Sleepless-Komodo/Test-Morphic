// DB reads behind /admin/margin and /admin/alerts. Kept out of the pages so they can be run
// against a scratch database directly. Relative .ts imports so plain `node` can load this file.
// Subquery aliases are prefixed: drizzle emits them unqualified, and a bare `credits` would
// clash with balances.credits.
import { and, desc, eq, gt, isNotNull, lt, lte, ne, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { IDR_PER_USD } from './money.ts';

const L = s.requestLogs;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ── Margin ───────────────────────────────────────────

/** All paid top-ups: Rupiah received (USD converted) and credits sold. */
export async function loadSales() {
  const [row] = await db
    .select({
      idr: sql<number>`coalesce(sum(case when ${s.payments.currency} = 'USD' then ${s.payments.amountCents}::numeric / 100 * ${IDR_PER_USD} else ${s.payments.amountCents} end), 0)::float8`,
      credits: sql<number>`coalesce(sum(${s.payments.credits}), 0)::float8`,
    })
    .from(s.payments)
    .where(eq(s.payments.status, 'paid'));
  return row!;
}

/** Successful usage per model + provider, with the model id we actually send upstream. */
export async function loadMarginUsage(since: Date | null) {
  const model = sql<string>`coalesce(${s.models.publicModelId}, ${L.modelAlias})`;
  const provider = sql<string | null>`coalesce(${s.providers.name}, ${L.providerName})`;
  return db
    .select({
      model,
      providerModelId: s.models.providerModelId,
      provider,
      requests: sql<number>`count(*)::int`,
      prompt: sql<number>`coalesce(sum(${L.promptTokens}), 0)::float8`,
      completion: sql<number>`coalesce(sum(${L.completionTokens}), 0)::float8`,
      credits: sql<number>`coalesce(sum(${L.creditsConsumed}), 0)::float8`,
    })
    .from(L)
    .leftJoin(s.models, eq(s.models.id, L.resolvedModelId))
    .leftJoin(s.providers, eq(s.providers.id, s.models.providerId))
    .where(and(eq(L.status, 'success'), since ? gt(L.createdAt, since) : undefined))
    .groupBy(model, s.models.providerModelId, provider);
}

// ── Alerts ───────────────────────────────────────────

export const ALERTS = {
  /** Key traffic in the last hour vs its hourly average over the 7 days before. */
  spikeRatio: 5,
  spikeMinRequests: 50,
  /** Key failure rate over the last hour. */
  errorRate: 0.5,
  errorMinRequests: 20,
  /** User credit use in the last 24h vs their daily average over the 7 days before. */
  burnRatio: 3,
  burnMinRequests: 20,
  /** Distinct accounts logging in from one IP in 30 days. */
  sharedIpUsers: 3,
  sharedIpDays: 30,
} as const;

export async function loadAlerts(now = new Date()) {
  const hourAgo = new Date(now.getTime() - HOUR);
  const dayAgo = new Date(now.getTime() - DAY);
  const weekBeforeHour = new Date(hourAgo.getTime() - 7 * DAY);
  const weekBeforeDay = new Date(dayAgo.getTime() - 7 * DAY);
  const ipSince = new Date(now.getTime() - ALERTS.sharedIpDays * DAY);

  const recent = db
    .select({ apiKeyId: L.apiKeyId, n: sql<number>`count(*)::int`.as('recent_n') })
    .from(L)
    .where(and(isNotNull(L.apiKeyId), gt(L.createdAt, hourAgo)))
    .groupBy(L.apiKeyId)
    .as('recent');
  const base = db
    .select({ apiKeyId: L.apiKeyId, perHour: sql<number>`(count(*)::float8 / 168)`.as('base_per_hour') })
    .from(L)
    .where(and(isNotNull(L.apiKeyId), gt(L.createdAt, weekBeforeHour), lte(L.createdAt, hourAgo)))
    .groupBy(L.apiKeyId)
    .as('base');

  const burnRecent = db
    .select({
      userId: L.userId,
      credits: sql<number>`coalesce(sum(${L.creditsConsumed}), 0)::float8`.as('burn_credits'),
      requests: sql<number>`count(*)::int`.as('burn_requests'),
    })
    .from(L)
    .where(and(isNotNull(L.userId), gt(L.createdAt, dayAgo)))
    .groupBy(L.userId)
    .as('burn_recent');
  const burnBase = db
    .select({ userId: L.userId, perDay: sql<number>`(coalesce(sum(${L.creditsConsumed}), 0)::float8 / 7)`.as('burn_per_day') })
    .from(L)
    .where(and(isNotNull(L.userId), gt(L.createdAt, weekBeforeDay), lte(L.createdAt, dayAgo)))
    .groupBy(L.userId)
    .as('burn_base');

  const ledger = db
    .select({ userId: s.creditLedger.userId, total: sql<number>`sum(${s.creditLedger.amount})::float8`.as('ledger_total') })
    .from(s.creditLedger)
    .where(eq(s.creditLedger.sourceType, 'balance'))
    .groupBy(s.creditLedger.userId)
    .as('ledger');

  const user = { userId: s.users.id, name: s.users.name, email: s.users.email, image: s.users.image, role: s.users.role };
  const stuckWhere = and(eq(s.reservations.status, 'reserved'), lt(s.reservations.expiresAt, now));

  const [spikes, errorKeys, burners, sharedIps, mismatches, stuck, [stuckTotal]] = await Promise.all([
    db
      .select({ keyId: s.apiKeys.id, keyName: s.apiKeys.name, keyPrefix: s.apiKeys.keyPrefix, ...user, lastHour: recent.n, perHour: sql<number>`coalesce(${base.perHour}, 0)` })
      .from(recent)
      .innerJoin(s.apiKeys, eq(s.apiKeys.id, recent.apiKeyId))
      .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId))
      .leftJoin(base, eq(base.apiKeyId, recent.apiKeyId))
      .where(and(sql`${recent.n} >= ${ALERTS.spikeMinRequests}`, sql`${recent.n} >= ${ALERTS.spikeRatio}::float8 * coalesce(${base.perHour}, 0)`))
      .orderBy(desc(recent.n))
      .limit(50),
    db
      .select({
        keyId: s.apiKeys.id,
        keyName: s.apiKeys.name,
        keyPrefix: s.apiKeys.keyPrefix,
        ...user,
        requests: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${L.status} <> 'success')::int`,
        topError: sql<string | null>`mode() within group (order by ${L.errorType}) filter (where ${L.status} <> 'success')`,
      })
      .from(L)
      .innerJoin(s.apiKeys, eq(s.apiKeys.id, L.apiKeyId))
      .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId))
      .where(gt(L.createdAt, hourAgo))
      .groupBy(s.apiKeys.id, s.users.id)
      .having(
        and(
          sql`count(*) >= ${ALERTS.errorMinRequests}`,
          sql`count(*) filter (where ${L.status} <> 'success') >= ${ALERTS.errorRate}::float8 * count(*)`,
        ),
      )
      .orderBy(desc(sql`count(*) filter (where ${L.status} <> 'success')`))
      .limit(50),
    db
      .select({
        ...user,
        last24h: burnRecent.credits,
        requests: burnRecent.requests,
        perDay: sql<number>`coalesce(${burnBase.perDay}, 0)`,
        balance: sql<number>`coalesce(${s.balances.credits}, 0)::float8`,
      })
      .from(burnRecent)
      .innerJoin(s.users, eq(s.users.id, burnRecent.userId))
      .leftJoin(burnBase, eq(burnBase.userId, burnRecent.userId))
      .leftJoin(s.balances, eq(s.balances.userId, burnRecent.userId))
      .where(
        and(
          sql`${burnRecent.requests} >= ${ALERTS.burnMinRequests}`,
          sql`${burnRecent.credits} > 0`,
          sql`${burnRecent.credits} >= ${ALERTS.burnRatio}::float8 * coalesce(${burnBase.perDay}, 0)`,
        ),
      )
      .orderBy(desc(burnRecent.credits))
      .limit(50),
    db
      .select({
        ip: s.sessions.ipAddress,
        users: sql<number>`count(distinct ${s.sessions.userId})::int`,
        emails: sql<string[]>`array_agg(distinct ${s.users.email})`,
        agents: sql<string[]>`array_agg(distinct ${s.sessions.userAgent})`,
        last: sql<string>`max(${s.sessions.createdAt})`,
      })
      .from(s.sessions)
      .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
      .where(
        and(
          gt(s.sessions.createdAt, ipSince),
          isNotNull(s.sessions.ipAddress),
          ne(s.sessions.ipAddress, ''),
          sql`${s.sessions.ipAddress} not in ('127.0.0.1', '::1')`,
        ),
      )
      .groupBy(s.sessions.ipAddress)
      .having(sql`count(distinct ${s.sessions.userId}) >= ${ALERTS.sharedIpUsers}`)
      .orderBy(desc(sql`count(distinct ${s.sessions.userId})`))
      .limit(50),
    db
      .select({
        ...user,
        cached: sql<number>`coalesce(${s.balances.credits}, 0)::float8`,
        ledger: sql<number>`coalesce(${ledger.total}, 0)`,
      })
      .from(s.users)
      .leftJoin(s.balances, eq(s.balances.userId, s.users.id))
      .leftJoin(ledger, eq(ledger.userId, s.users.id))
      .where(sql`coalesce(${s.balances.credits}, 0) <> coalesce(${ledger.total}, 0)`)
      .orderBy(desc(sql`abs(coalesce(${s.balances.credits}, 0) - coalesce(${ledger.total}, 0))`))
      .limit(100),
    db
      .select({
        id: s.reservations.id,
        ...user,
        credits: s.reservations.estimatedCredits,
        sourceType: s.reservations.sourceType,
        createdAt: s.reservations.createdAt,
        expiresAt: s.reservations.expiresAt,
      })
      .from(s.reservations)
      .innerJoin(s.users, eq(s.users.id, s.reservations.userId))
      .where(stuckWhere)
      .orderBy(s.reservations.expiresAt)
      .limit(100),
    db
      .select({ n: sql<number>`count(*)::int`, credits: sql<number>`coalesce(sum(${s.reservations.estimatedCredits}), 0)::float8` })
      .from(s.reservations)
      .where(stuckWhere),
  ]);

  return { spikes, errorKeys, burners, sharedIps, mismatches, stuck, stuckTotal: stuckTotal! };
}
