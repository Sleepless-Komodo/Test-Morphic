import { Suspense } from 'react';
import { sql, eq, gte } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { formatCredits } from '@/lib/utils';
import { Activity, AlertTriangle, CheckCircle2, Clock, ServerCrash } from 'lucide-react';

// ── Skeletons ──────────────────────────────────────────────

function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card bg-neutral-100/80 p-5 rounded-2xl border border-neutral-200/60 backdrop-blur-sm h-28 flex flex-col justify-between">
          <div className="h-4 bg-neutral-300/60 rounded w-2/3"></div>
          <div className="h-8 bg-neutral-300/80 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}

function SectionCardSkeleton() {
  return (
    <div className="card bg-neutral-100/60 p-5 rounded-2xl border border-neutral-200/60 backdrop-blur-sm h-64 animate-pulse flex flex-col justify-between">
      <div className="h-5 bg-neutral-300/70 rounded w-1/3 mb-4"></div>
      <div className="space-y-3 flex-1">
        <div className="h-4 bg-neutral-200 rounded w-full"></div>
        <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
        <div className="h-4 bg-neutral-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}

// ── Async Sub-components ───────────────────────────────────

async function AlertBannerSection() {
  const fiveMinCutoff = new Date(Date.now() - 5 * 60_000);
  let fiveMinStats: { providerName: string | null; total: number; errors: number }[] = [];
  try {
    fiveMinStats = await db
      .select({
        providerName: s.requestLogs.providerName,
        total: sql<number>`count(*)::int`,
        errors: sql<number>`count(case when ${s.requestLogs.status} = 'error' then 1 end)::int`,
      })
      .from(s.requestLogs)
      .where(gte(s.requestLogs.createdAt, fiveMinCutoff))
      .groupBy(s.requestLogs.providerName);
  } catch {
    return null; // Silently skip alert banner if DB is unavailable
  }

  const alertingProviders = fiveMinStats
    .filter((s) => s.providerName && s.total >= 5 && s.errors / s.total >= 0.5)
    .map((s) => ({
      name: s.providerName!,
      rate: ((s.errors / s.total) * 100).toFixed(1),
      errors: s.errors,
      total: s.total,
    }));

  if (alertingProviders.length === 0) return null;

  return (
    <div className="bg-red-50 border-2 border-red-300 p-4 rounded-2xl flex items-center justify-between text-red-900 shadow-sm animate-pulse">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
        <div>
          <div className="font-bold text-sm">CRITICAL PROVIDER ALERT (§5.7)</div>
          <div className="text-xs text-red-700">
            {alertingProviders
              .map((ap) => `${ap.name}: ${ap.rate}% error rate (${ap.errors}/${ap.total} reqs in 5m)`)
              .join(' | ')}
          </div>
        </div>
      </div>
      <a href="/admin/providers" className="text-xs font-bold text-red-700 underline hover:text-red-900">
        View Providers &rarr;
      </a>
    </div>
  );
}

async function CoreStatsCardsSection() {
  let users: { count: number } | undefined;
  let models: { count: number } | undefined;
  let payments: { count: number; total: number } | undefined;
  let usage: { requests: number; credits: number } | undefined;

  try {
    [[users], [models], [payments], [usage]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(s.users),
    db.select({ count: sql<number>`count(*)::int` }).from(s.models),
    db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${s.payments.amountCents}),0)::int`,
      })
      .from(s.payments)
      .where(eq(s.payments.status, 'paid')),
    db
      .select({
        requests: sql<number>`count(*)::int`,
        credits: sql<number>`coalesce(sum(${s.usageRecords.creditsConsumed}),0)::bigint`,
      })
      .from(s.usageRecords),
    ]);
  } catch {
    // DB timeout — render cards with zero values so page still loads
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card bg-white p-5 rounded-2xl border border-neutral-200 transition-all hover:shadow-sm">
        <div className="text-sm font-semibold text-neutral-500 mb-1">Total Users</div>
        <div className="text-3xl font-black">{formatCredits(users?.count ?? 0)}</div>
      </div>
      <div className="card bg-white p-5 rounded-2xl border border-neutral-200 transition-all hover:shadow-sm">
        <div className="text-sm font-semibold text-neutral-500 mb-1">Active Models</div>
        <div className="text-3xl font-black">{formatCredits(models?.count ?? 0)}</div>
      </div>
      <div className="card bg-emerald-50 p-5 rounded-2xl border border-emerald-100 transition-all hover:shadow-sm">
        <div className="text-sm font-semibold text-emerald-700 mb-1">Revenue (Paid)</div>
        <div className="text-2xl font-black text-emerald-900">Rp{formatCredits(payments?.total ?? 0)}</div>
        <div className="text-xs text-emerald-600 font-medium mt-1">{formatCredits(payments?.count ?? 0)} txs</div>
      </div>
      <div className="card bg-blue-50 p-5 rounded-2xl border border-blue-100 transition-all hover:shadow-sm">
        <div className="text-sm font-semibold text-blue-700 mb-1">Total Usage</div>
        <div className="text-2xl font-black text-blue-900">{formatCredits(usage?.requests ?? 0)} reqs</div>
        <div className="text-xs text-blue-600 font-medium mt-1">{formatCredits(Number(usage?.credits ?? 0))} cr burned</div>
      </div>
    </div>
  );
}

async function ProviderHealth24hSection() {
  let healthStats: any[] = [];
  try {
    healthStats = await db
      .select({
        providerName: s.requestLogs.providerName,
        total: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${s.requestLogs.status} = 'error')::int`,
        p50Latency: sql<number>`percentile_cont(0.5) within group (order by ${s.requestLogs.gatewayLatencyMs})::int`,
        p95Latency: sql<number>`percentile_cont(0.95) within group (order by ${s.requestLogs.gatewayLatencyMs})::int`,
        providerTokens: sql<number>`coalesce(sum(${s.requestLogs.promptTokens} + ${s.requestLogs.completionTokens}),0)::bigint`,
        morphicCredits: sql<number>`coalesce(sum(${s.requestLogs.creditsConsumed}),0)::bigint`,
      })
      .from(s.requestLogs)
      .where(sql`${s.requestLogs.createdAt} > now() - interval '24 hours'`)
      .groupBy(s.requestLogs.providerName);
  } catch {
    // Graceful fallback for DB timeout
  }

  return (
    <div className="card bg-white p-5 rounded-2xl border border-neutral-200">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-neutral-400" />
        <h2 className="text-lg font-bold">Provider Health (24h)</h2>
      </div>
      {healthStats.length === 0 ? (
        <div className="text-sm text-neutral-500">No requests in the last 24 hours.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left font-semibold text-neutral-500 pb-2">Provider</th>
                <th className="text-right font-semibold text-neutral-500 pb-2">Reqs</th>
                <th className="text-right font-semibold text-neutral-500 pb-2">Error</th>
                <th className="text-right font-semibold text-neutral-500 pb-2">Prov. Tokens</th>
                <th className="text-right font-semibold text-neutral-500 pb-2">Morph. Cr</th>
                <th className="text-right font-semibold text-neutral-500 pb-2">p50/p95</th>
              </tr>
            </thead>
            <tbody>
              {healthStats.map((h) => {
                const errorRate = h.total > 0 ? (h.errors / h.total) * 100 : 0;
                return (
                  <tr key={h.providerName} className="border-b border-neutral-50 last:border-0">
                    <td className="py-2.5 font-medium">{h.providerName || 'unknown'}</td>
                    <td className="py-2.5 text-right text-neutral-600">{formatCredits(h.total)}</td>
                    <td className="py-2.5 text-right">
                      <span className={`font-mono ${errorRate > 10 ? 'text-red-500 font-bold' : errorRate > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                        {errorRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-neutral-600 text-xs font-mono">{formatCredits(Number(h.providerTokens ?? 0))}</td>
                    <td className="py-2.5 text-right text-neutral-600 text-xs font-mono">{formatCredits(Number(h.morphicCredits ?? 0))}</td>
                    <td className="py-2.5 text-right font-mono text-neutral-500 text-xs">
                      {h.p50Latency ?? 0}ms / {h.p95Latency ?? 0}ms
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function CircuitBreakersSection() {
  let providers: { name: string; status: string; circuitBreaker: any }[] = [];
  try {
    providers = await db
      .select({
        name: s.providers.name,
        status: s.providers.status,
        circuitBreaker: s.providers.circuitBreakerState,
      })
      .from(s.providers);
  } catch {
    // Graceful fallback for DB timeout
  }

  return (
    <div className="card bg-white p-5 rounded-2xl border border-neutral-200">
      <div className="flex items-center gap-2 mb-4">
        <ServerCrash className="w-5 h-5 text-neutral-400" />
        <h2 className="text-lg font-bold">Circuit Breakers</h2>
      </div>
      {providers.length === 0 ? (
        <div className="text-sm text-neutral-500">No providers configured.</div>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => {
            const cb = p.circuitBreaker;
            return (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-neutral-50/50">
                <div>
                  <div className="font-semibold text-neutral-900 flex items-center gap-2">
                    {p.name}
                    {p.status === 'disabled' && <span className="text-[10px] uppercase font-bold text-neutral-400 border border-neutral-200 px-1.5 rounded">Disabled</span>}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Failures: {cb.failures} {cb.lastFailure ? `(Last: ${new Date(cb.lastFailure).toLocaleTimeString()})` : ''}
                  </div>
                </div>
                <div>
                  {cb.state === 'closed' ? (
                    <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      HEALTHY
                    </div>
                  ) : cb.state === 'half-open' ? (
                    <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full text-xs font-bold border border-orange-100">
                      <Clock className="w-3.5 h-3.5" />
                      TESTING
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2.5 py-1 rounded-full text-xs font-bold border border-red-100">
                      <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                      OPEN (TRIPPED)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page Layout (Renders shell immediately) ───────────

export default async function AdminOverview() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <h1 className="text-2xl font-bold">Admin Overview</h1>

      <Suspense fallback={null}>
        <AlertBannerSection />
      </Suspense>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <CoreStatsCardsSection />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<SectionCardSkeleton />}>
          <ProviderHealth24hSection />
        </Suspense>

        <Suspense fallback={<SectionCardSkeleton />}>
          <CircuitBreakersSection />
        </Suspense>
      </div>
    </div>
  );
}
