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
  const agg = db
    .select({
      resolvedModelId: L.resolvedModelId,
      modelAlias: L.modelAlias,
      providerName: L.providerName,
      requests: sql<number>`count(*)::int`.as('agg_requests'),
      prompt: sql<number>`coalesce(sum(${L.promptTokens}), 0)::float8`.as('agg_prompt'),
      completion: sql<number>`coalesce(sum(${L.completionTokens}), 0)::float8`.as('agg_completion'),
      credits: sql<number>`coalesce(sum(${L.creditsConsumed}), 0)::float8`.as('agg_credits'),
    })
    .from(L)
    .where(and(eq(L.status, 'success'), since ? gt(L.createdAt, since) : undefined))
    .groupBy(L.resolvedModelId, L.modelAlias, L.providerName)
    .as('margin_agg');

  const model = sql<string>`coalesce(${s.models.publicModelId}, ${agg.modelAlias})`;
  const provider = sql<string | null>`coalesce(${s.providers.name}, ${agg.providerName})`;
  return db
    .select({
      model,
      providerModelId: s.models.providerModelId,
      provider,
      requests: sql<number>`sum(${agg.requests})::int`,
      prompt: sql<number>`coalesce(sum(${agg.prompt}), 0)::float8`,
      completion: sql<number>`coalesce(sum(${agg.completion}), 0)::float8`,
      credits: sql<number>`coalesce(sum(${agg.credits}), 0)::float8`,
    })
    .from(agg)
    .leftJoin(s.models, eq(s.models.id, agg.resolvedModelId))
    .leftJoin(s.providers, eq(s.providers.id, s.models.providerId))
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
    .having(sql`count(*) >= ${ALERTS.spikeMinRequests}`)
    .as('recent');
  const base = db
    .select({ apiKeyId: L.apiKeyId, perHour: sql<number>`(count(*)::float8 / 168)`.as('base_per_hour') })
    .from(L)
    .where(and(isNotNull(L.apiKeyId), gt(L.createdAt, weekBeforeHour), lte(L.createdAt, hourAgo)))
    .groupBy(L.apiKeyId)
    .as('base');

  const errRecent = db
    .select({
      apiKeyId: L.apiKeyId,
      requests: sql<number>`count(*)::int`.as('err_requests'),
      errors: sql<number>`count(*) filter (where ${L.status} <> 'success')::int`.as('err_errors'),
      topError: sql<string | null>`mode() within group (order by ${L.errorType}) filter (where ${L.status} <> 'success')`.as('err_top_error'),
    })
    .from(L)
    .where(and(isNotNull(L.apiKeyId), gt(L.createdAt, hourAgo)))
    .groupBy(L.apiKeyId)
    .having(
      and(
        sql`count(*) >= ${ALERTS.errorMinRequests}`,
        sql`count(*) filter (where ${L.status} <> 'success') >= ${ALERTS.errorRate}::float8 * count(*)`,
      ),
    )
    .as('err_recent');

  const burnRecent = db
    .select({
      userId: L.userId,
      credits: sql<number>`coalesce(sum(${L.creditsConsumed}), 0)::float8`.as('burn_credits'),
      requests: sql<number>`count(*)::int`.as('burn_requests'),
    })
    .from(L)
    .where(and(isNotNull(L.userId), gt(L.createdAt, dayAgo)))
    .groupBy(L.userId)
    .having(and(sql`count(*) >= ${ALERTS.burnMinRequests}`, sql`coalesce(sum(${L.creditsConsumed}), 0) > 0`))
    .as('burn_recent');
  const burnBase = db
    .select({ userId: L.userId, perDay: sql<number>`(coalesce(sum(${L.creditsConsumed}), 0)::float8 / 7)`.as('burn_per_day') })
    .from(L)
    .where(and(isNotNull(L.userId), gt(L.createdAt, weekBeforeDay), lte(L.createdAt, dayAgo)))
    .groupBy(L.userId)
    .as('burn_base');

  const sharedIpAgg = db
    .select({
      ip: s.sessions.ipAddress,
      users: sql<number>`count(distinct ${s.sessions.userId})::int`.as('ip_users'),
      last: sql<string>`max(${s.sessions.createdAt})`.as('ip_last'),
    })
    .from(s.sessions)
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
    .limit(50)
    .as('shared_ip_agg');

  const ledger = db
    .select({ userId: s.creditLedger.userId, total: sql<number>`sum(${s.creditLedger.amount})::float8`.as('ledger_total') })
    .from(s.creditLedger)
    .where(eq(s.creditLedger.sourceType, 'balance'))
    .groupBy(s.creditLedger.userId)
    .as('ledger');

  const mismatchDiff = db
    .select({
      userId: sql<string>`coalesce(${s.balances.userId}, ${ledger.userId})`.as('mismatch_user_id'),
      cached: sql<number>`coalesce(${s.balances.credits}, 0)::float8`.as('mismatch_cached'),
      ledger: sql<number>`coalesce(${ledger.total}, 0)::float8`.as('mismatch_ledger'),
    })
    .from(s.balances)
    .fullJoin(ledger, eq(ledger.userId, s.balances.userId))
    .where(sql`coalesce(${s.balances.credits}, 0) <> coalesce(${ledger.total}, 0)`)
    .orderBy(desc(sql`abs(coalesce(${s.balances.credits}, 0) - coalesce(${ledger.total}, 0))`))
    .limit(100)
    .as('mismatch_diff');

  const user = { userId: s.users.id, name: s.users.name, email: s.users.email, image: s.users.image, role: s.users.role };
  const stuckWhere = and(eq(s.reservations.status, 'reserved'), lt(s.reservations.expiresAt, now));

  const [spikes, errorKeys, burners, sharedIps, mismatches, stuckRows] = await Promise.all([
    db
      .select({ keyId: s.apiKeys.id, keyName: s.apiKeys.name, keyPrefix: s.apiKeys.keyPrefix, ...user, lastHour: recent.n, perHour: sql<number>`coalesce(${base.perHour}, 0)` })
      .from(recent)
      .innerJoin(s.apiKeys, eq(s.apiKeys.id, recent.apiKeyId))
      .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId))
      .leftJoin(base, eq(base.apiKeyId, recent.apiKeyId))
      .where(sql`${recent.n} >= ${ALERTS.spikeRatio}::float8 * coalesce(${base.perHour}, 0)`)
      .orderBy(desc(recent.n))
      .limit(50),
    db
      .select({
        keyId: s.apiKeys.id,
        keyName: s.apiKeys.name,
        keyPrefix: s.apiKeys.keyPrefix,
        ...user,
        requests: errRecent.requests,
        errors: errRecent.errors,
        topError: errRecent.topError,
      })
      .from(errRecent)
      .innerJoin(s.apiKeys, eq(s.apiKeys.id, errRecent.apiKeyId))
      .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId))
      .orderBy(desc(errRecent.errors))
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
      .where(sql`${burnRecent.credits} >= ${ALERTS.burnRatio}::float8 * coalesce(${burnBase.perDay}, 0)`)
      .orderBy(desc(burnRecent.credits))
      .limit(50),
    db
      .select({
        ip: sharedIpAgg.ip,
        users: sharedIpAgg.users,
        emails: sql<string[]>`array_agg(distinct ${s.users.email})`,
        agents: sql<string[]>`array_agg(distinct ${s.sessions.userAgent})`,
        last: sharedIpAgg.last,
      })
      .from(sharedIpAgg)
      .innerJoin(s.sessions, and(eq(s.sessions.ipAddress, sharedIpAgg.ip), gt(s.sessions.createdAt, ipSince)))
      .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
      .groupBy(sharedIpAgg.ip, sharedIpAgg.users, sharedIpAgg.last)
      .orderBy(desc(sharedIpAgg.users)),
    db
      .select({
        ...user,
        cached: mismatchDiff.cached,
        ledger: mismatchDiff.ledger,
      })
      .from(mismatchDiff)
      .innerJoin(s.users, eq(s.users.id, mismatchDiff.userId))
      .orderBy(desc(sql`abs(${mismatchDiff.cached} - ${mismatchDiff.ledger})`)),
    db
      .select({
        id: s.reservations.id,
        ...user,
        credits: s.reservations.estimatedCredits,
        sourceType: s.reservations.sourceType,
        createdAt: s.reservations.createdAt,
        expiresAt: s.reservations.expiresAt,
        totalCount: sql<number>`count(*) over ()::int`,
        totalCredits: sql<number>`coalesce(sum(${s.reservations.estimatedCredits}) over (), 0)::float8`,
      })
      .from(s.reservations)
      .innerJoin(s.users, eq(s.users.id, s.reservations.userId))
      .where(stuckWhere)
      .orderBy(s.reservations.expiresAt)
      .limit(100),
  ]);

  const stuckTotal = stuckRows.length > 0
    ? { n: stuckRows[0]!.totalCount, credits: stuckRows[0]!.totalCredits }
    : { n: 0, credits: 0 };
  const stuck = stuckRows.map(({ totalCount: _tc, totalCredits: _tcr, ...r }) => r);

  return { spikes, errorKeys, burners, sharedIps, mismatches, stuck, stuckTotal };
}
