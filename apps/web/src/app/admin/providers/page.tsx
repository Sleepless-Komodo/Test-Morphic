import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { saveProvider } from '@/lib/admin-actions';
import { sql, gte } from 'drizzle-orm';
import { Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

export default async function AdminProviders() {
  await requireAdmin();
  
  const providers = await db.select().from(s.providers);

  // 5-minute live health monitoring for Observability Alerts (§5.7)
  const fiveMinCutoff = new Date(Date.now() - 5 * 60_000);
  const liveStats = await db
    .select({
      providerName: s.requestLogs.providerName,
      totalRequests: sql<number>`count(*)::int`,
      errorRequests: sql<number>`count(case when ${s.requestLogs.status} = 'error' then 1 end)::int`,
    })
    .from(s.requestLogs)
    .where(gte(s.requestLogs.createdAt, fiveMinCutoff))
    .groupBy(s.requestLogs.providerName);

  const statsMap = new Map(
    liveStats
      .filter((s): s is typeof s & { providerName: string } => Boolean(s.providerName))
      .map((s) => [s.providerName, s])
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Providers</h1>
        <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium bg-neutral-100 px-3 py-1.5 rounded-full border border-neutral-200">
          <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          Live 5-Min Observability Alert Active
        </div>
      </div>

      {/* 5-Min Live Health Card */}
      <div className="card bg-white p-5 rounded-2xl border border-neutral-200">
        <div className="text-sm font-semibold mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            5-Minute Provider Error Rate Monitor (§5.7)
          </span>
          <span className="text-xs text-neutral-400 font-normal">Auto-alert threshold: 50%</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map((p) => {
            const stat = statsMap.get(p.name);
            const total = stat?.totalRequests ?? 0;
            const errors = stat?.errorRequests ?? 0;
            const rate = total > 0 ? (errors / total) * 100 : 0;
            const isAlerting = total >= 5 && rate >= 50;
            const isDegraded = total >= 5 && rate >= 20;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-2 ${
                  isAlerting
                    ? 'bg-red-50/80 border-red-200'
                    : isDegraded
                    ? 'bg-orange-50/80 border-orange-200'
                    : 'bg-neutral-50/60 border-neutral-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-neutral-900">{p.name}</span>
                  {isAlerting ? (
                    <span className="flex items-center gap-1 text-[11px] font-extrabold text-red-600 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3 animate-pulse" /> ALERTING
                    </span>
                  ) : isDegraded ? (
                    <span className="flex items-center gap-1 text-[11px] font-extrabold text-orange-600 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-full">
                      DEGRADED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> HEALTHY
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-600 font-mono">
                  Error Rate: <span className={`font-bold ${isAlerting ? 'text-red-600' : 'text-neutral-900'}`}>{rate.toFixed(1)}%</span> ({errors}/{total} reqs in 5m)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card bg-white p-5 rounded-2xl border border-neutral-200">
        <div className="text-sm font-medium mb-3">Add / Update Provider</div>
        <form action={saveProvider} className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input type="hidden" name="id" value="" />
          <input name="name" className="input" placeholder="provider name (e.g. moonshot)" required />
          <input name="baseUrl" className="input" placeholder="https://api.provider.com/v1" required />
          <input
            name="credential"
            className="input"
            type="password"
            placeholder="API credential (encrypted at rest, write-only)"
          />
          <select name="status" className="input">
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <button className="btn btn-primary">Create Provider</button>
        </form>
        <div className="text-xs text-[var(--muted)] mt-2">
          Credentials are AES-256-GCM encrypted before storage and never rendered back.
        </div>
      </div>

      <div className="card bg-white p-5 rounded-2xl border border-neutral-200">
        <table className="data">
          <thead>
            <tr><th>Name</th><th>Base URL</th><th>Credential</th><th>Status</th></tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="font-mono text-xs text-[var(--muted)]">{p.baseUrl}</td>
                <td className="text-xs text-[var(--muted)]">
                  {p.encryptedCredentials ? 'encrypted ✓' : p.credentialReference ?? '—'}
                </td>
                <td><span className={p.status === 'active' ? 'badge badge-active' : 'badge'}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
