import { eq, desc, sql, and, gt } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireUser } from '@/lib/actions';
import { getBalance } from '@morphic/db/billing';
import { formatCredits, timeAgo } from '@/lib/utils';

export default async function Overview() {
  const user = await requireUser();
  const balance = await getBalance(user.id);

  const activeEntitlements = await db
    .select({
      id: s.entitlements.id,
      remaining: s.entitlements.remaining,
      expiresAt: s.entitlements.expiresAt,
      displayName: s.models.displayName,
    })
    .from(s.entitlements)
    .leftJoin(s.models, eq(s.entitlements.modelId, s.models.id))
    .where(
      and(
        eq(s.entitlements.userId, user.id),
        eq(s.entitlements.status, 'active'),
        gt(s.entitlements.expiresAt, new Date()),
      ),
    );

  const recentUsage = await db
    .select({
      credits: sql<number>`sum(${s.usageRecords.creditsConsumed})`,
      requests: sql<number>`count(*)`,
      model: s.models.displayName,
    })
    .from(s.usageRecords)
    .leftJoin(s.models, eq(s.usageRecords.modelId, s.models.id))
    .where(eq(s.usageRecords.userId, user.id))
    .groupBy(s.models.displayName)
    .orderBy(desc(sql`sum(${s.usageRecords.creditsConsumed})`))
    .limit(5);

  const recentTx = await db
    .select({
      entryType: s.creditLedger.entryType,
      amount: s.creditLedger.amount,
      createdAt: s.creditLedger.createdAt,
    })
    .from(s.creditLedger)
    .where(eq(s.creditLedger.userId, user.id))
    .orderBy(desc(s.creditLedger.createdAt))
    .limit(8);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-[var(--muted)]">Balance</div>
          <div className="text-3xl font-bold">{formatCredits(balance)}</div>
          <div className="text-xs text-[var(--muted)]">credits</div>
        </div>
        <div className="card">
          <div className="text-sm text-[var(--muted)]">Active Packages</div>
          {activeEntitlements.length === 0 ? (
            <div className="text-sm text-[var(--muted)] mt-2">None</div>
          ) : (
            activeEntitlements.map((e) => (
              <div key={e.id} className="mt-2 text-sm">
                <div className="font-medium">{e.displayName ?? 'All models'}</div>
                <div className="text-xs text-[var(--muted)]">
                  {formatCredits(e.remaining)} left · expires {timeAgo(e.expiresAt).replace(' ago', '')}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <div className="text-sm text-[var(--muted)]">API Status</div>
          <div className="mt-2"><span className="badge badge-active">Operational</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm text-[var(--muted)] mb-3">Top Usage</div>
          {recentUsage.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">No usage yet</div>
          ) : (
            <table className="data">
              <tbody>
                {recentUsage.map((u, i) => (
                  <tr key={i}>
                    <td>{u.model ?? '—'}</td>
                    <td className="text-right">{formatCredits(Number(u.credits ?? 0))} cr</td>
                    <td className="text-right text-[var(--muted)]">{Number(u.requests)} req</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <div className="text-sm text-[var(--muted)] mb-3">Recent Transactions</div>
          {recentTx.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">None</div>
          ) : (
            <table className="data">
              <tbody>
                {recentTx.map((t, i) => (
                  <tr key={i}>
                    <td className="capitalize">{t.entryType.replace('_', ' ')}</td>
                    <td className={t.amount >= 0 ? 'text-right text-green-400' : 'text-right text-red-400'}>
                      {t.amount >= 0 ? '+' : ''}{formatCredits(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
