// apps/web/src/lib/model-detail.ts
// TypeScript / Next.js Server Module / Node.js / Linux x86_64
import { and, eq, ne, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import type { SnapshotModel } from './model-catalog';
import { providerUsable } from '@morphic/shared/model-readiness';
import { hasStoredCredentials } from './models-data';

export interface ProviderBucket {
  /** ISO start of the hour (1D/72H) or WIB day (1W/30D) */
  at: string;
  total: number;
  errors: number;
  /** P50 end-to-end latency, ms */
  p50LatencyMs: number | null;
  /** P50 output tokens per second over the whole request */
  p50Tps: number | null;
}

export interface ModelDetail {
  model: {
    publicModelId: string;
    displayName: string;
    description: string | null;
    contextLength: number;
    capabilities: string[];
    inputCreditsPer1m: number;
    outputCreditsPer1m: number;
    status: string;
    replacementModelAlias: string | null;
    createdAt: string;
  };
  /** A route with a key exists right now, so the gateway can serve this model. Which upstream it is never leaves the server. */
  ready: boolean;
  hourly: ProviderBucket[];
  daily: ProviderBucket[];
  /** Tokens per WIB day, last 30 days, across every route. */
  activity: {
    day: string;
    tokens: number;
    promptTokens?: number;
    completionTokens?: number;
    requests: number;
  }[];
  related: { publicModelId: string; displayName: string; description: string | null; tokens7d: number; makerLogo?: string | null }[];
  /** Catalog snapshot entry for this model: maker, logos, modalities, upstream providers and list price. */
  meta?: SnapshotModel | null;
}

// Output tokens over total request time, so TTFT is included: a conservative throughput.
const TPS = sql`${s.requestLogs.completionTokens}::float / nullif(${s.requestLogs.latencyMs}, 0) * 1000`;

function bucketQuery(modelId: string, unit: 'hour' | 'day', interval: string) {
  const at =
    unit === 'hour'
      ? sql<string>`to_char(date_trunc('hour', ${s.requestLogs.createdAt} at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"')`
      : sql<string>`to_char(${s.requestLogs.createdAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;
  return db
    .select({
      at,
      total: sql<number>`count(*)::int`,
      errors: sql<number>`count(*) filter (where ${s.requestLogs.status} = 'error')::int`,
      p50LatencyMs: sql<number | null>`percentile_cont(0.5) within group (order by ${s.requestLogs.latencyMs}) filter (where ${s.requestLogs.status} = 'success')`,
      p50Tps: sql<number | null>`percentile_cont(0.5) within group (order by ${TPS}) filter (where ${s.requestLogs.status} = 'success' and ${s.requestLogs.completionTokens} > 0)`,
    })
    .from(s.requestLogs)
    .where(and(eq(s.requestLogs.resolvedModelId, modelId), sql`${s.requestLogs.createdAt} > now() - ${sql.raw(`interval '${interval}'`)}`))
    .groupBy(sql`1`);
}

const toBucket = (r: { at: string; total: number; errors: number; p50LatencyMs: number | null; p50Tps: number | null }): ProviderBucket => ({
  at: r.at,
  total: Number(r.total),
  errors: Number(r.errors),
  p50LatencyMs: r.p50LatencyMs === null ? null : Number(r.p50LatencyMs),
  p50Tps: r.p50Tps === null ? null : Number(r.p50Tps),
});

/** Everything the public model page shows; null when the id is unknown or inactive.
 *  providerModelId is server-only (catalog matching); the page strips it before rendering. */
export async function loadModelDetail(publicModelId: string): Promise<(ModelDetail & { providerModelId: string }) | null> {
  const [row] = await db
    .select({
      id: s.models.id,
      publicModelId: s.models.publicModelId,
      providerModelId: s.models.providerModelId,
      displayName: s.models.displayName,
      description: s.models.description,
      contextLength: s.models.contextLength,
      capabilities: s.models.capabilities,
      inputCreditsPer1m: s.models.inputCreditsPer1m,
      outputCreditsPer1m: s.models.outputCreditsPer1m,
      status: s.models.status,
      replacementModelAlias: s.models.replacementModelAlias,
      createdAt: s.models.createdAt,
      providerId: s.models.providerId,
      fallbackProviderId: s.models.fallbackProviderId,
    })
    .from(s.models)
    .where(and(eq(s.models.publicModelId, publicModelId), ne(s.models.status, 'inactive')))
    .limit(1);
  if (!row) return null;

  const [providerRows, pool, hourly, daily, activity, siblings] = await Promise.all([
    db
      .select({
        id: s.providers.id,
        status: s.providers.status,
        encryptedCredentials: hasStoredCredentials,
        credentialReference: s.providers.credentialReference,
      })
      .from(s.providers),
    db
      .select({ providerId: s.modelProviderPool.providerId })
      .from(s.modelProviderPool)
      .where(and(eq(s.modelProviderPool.modelId, row.id), eq(s.modelProviderPool.isEnabled, true))),
    bucketQuery(row.id, 'hour', '72 hours'),
    bucketQuery(row.id, 'day', '30 days'),
    db
      .select({
        day: sql<string>`to_char(${s.requestLogs.createdAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`,
        // Tokens only count when a request succeeded; a failed call processed nothing.
        tokens: sql<number>`coalesce(sum(coalesce(${s.requestLogs.promptTokens},0) + coalesce(${s.requestLogs.completionTokens},0)) filter (where ${s.requestLogs.status} = 'success'),0)::bigint`,
        promptTokens: sql<number>`coalesce(sum(coalesce(${s.requestLogs.promptTokens},0)) filter (where ${s.requestLogs.status} = 'success'),0)::bigint`,
        completionTokens: sql<number>`coalesce(sum(coalesce(${s.requestLogs.completionTokens},0)) filter (where ${s.requestLogs.status} = 'success'),0)::bigint`,
        requests: sql<number>`count(*)::int`,
      })
      .from(s.requestLogs)
      .where(and(eq(s.requestLogs.resolvedModelId, row.id), sql`${s.requestLogs.createdAt} > now() - interval '30 days'`))
      .groupBy(sql`1`),
    db
      .select({
        publicModelId: s.models.publicModelId,
        displayName: s.models.displayName,
        description: s.models.description,
        tokens7d: sql<number>`(select coalesce(sum(coalesce(prompt_tokens,0) + coalesce(completion_tokens,0)),0) from request_logs rl where rl.resolved_model_id = ${s.models.id} and rl.status = 'success' and rl.created_at > now() - interval '7 days')::bigint`,
      })
      .from(s.models)
      .where(and(eq(s.models.status, 'active'), ne(s.models.id, row.id))),
  ]);

  // Which upstream serves a request is never sent to the page; it only learns whether any route can.
  // Credentials only decide readiness; they never leave this function.
  const usable = new Set(providerRows.filter((p) => providerUsable(p)).map((p) => p.id));
  const { id: _id, providerId, fallbackProviderId, providerModelId, ...model } = row;
  const ready = [providerId, fallbackProviderId, ...pool.map((p) => p.providerId)].some((id) => !!id && usable.has(id));

  return {
    model: { ...model, capabilities: model.capabilities ?? [], createdAt: model.createdAt.toISOString() },
    ready,
    hourly: hourly.map(toBucket),
    daily: daily.map(toBucket),
    activity: activity.map((a) => ({
      ...a,
      tokens: Number(a.tokens),
      promptTokens: Number(a.promptTokens),
      completionTokens: Number(a.completionTokens),
      requests: Number(a.requests),
    })),
    // Caller narrows these to the same maker; the maker lives in the id, not a column.
    related: siblings.map((r) => ({ ...r, tokens7d: Number(r.tokens7d) })),
    providerModelId,
  };
}
