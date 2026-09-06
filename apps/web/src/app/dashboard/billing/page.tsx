import { eq, desc, and, gt } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireUser } from '@/lib/actions';
import { getBalance } from '@morphic/db/billing';
import { formatCredits } from '@/lib/utils';
import { BuyPackages } from './buy-packages';

export default async function BillingPage() {
  const user = await requireUser();
  const [balance, packages, entitlements, payments] = await Promise.all([
    getBalance(user.id),
    db.select().from(s.packages).where(eq(s.packages.status, 'active')),
    db
      .select({
        id: s.entitlements.id,
        remaining: s.entitlements.remaining,
        expiresAt: s.entitlements.expiresAt,
        packageName: s.packages.name,
        displayName: s.models.displayName,
      })
      .from(s.entitlements)
      .leftJoin(s.packages, eq(s.entitlements.packageId, s.packages.id))
      .leftJoin(s.models, eq(s.entitlements.modelId, s.models.id))
      .where(
        and(eq(s.entitlements.userId, user.id), eq(s.entitlements.status, 'active'), gt(s.entitlements.expiresAt, new Date())),
      ),
    db
      .select()
      .from(s.payments)
      .where(eq(s.payments.userId, user.id))
      .orderBy(desc(s.payments.createdAt))
      .limit(20),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Billing</h1>

      <div className="card flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--muted)]">Balance</div>
          <div className="text-3xl font-bold">{formatCredits(balance)} <span className="text-sm text-[var(--muted)]">credits</span></div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Buy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((p) => (
            <div key={p.id} className="card flex flex-col gap-2">
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-[var(--muted)]">{p.description}</div>
              <div className="text-xl font-bold">
                Rp{(p.priceCents ?? 0).toLocaleString('id-ID')}
              </div>
              <BuyPackages packageId={p.id} />
            </div>
          ))}
        </div>
      </div>

      {entitlements.length > 0 && (
        <div className="card">
          <div className="text-sm text-[var(--muted)] mb-3">Active Packages</div>
          <table className="data">
            <thead>
              <tr><th>Package</th><th>Model</th><th className="text-right">Remaining</th><th>Expires</th></tr>
            </thead>
            <tbody>
              {entitlements.map((e) => (
                <tr key={e.id}>
                  <td>{e.packageName ?? 'Entitlement'}</td>
                  <td>{e.displayName ?? 'All models'}</td>
                  <td className="text-right">{formatCredits(e.remaining)}</td>
                  <td>{e.expiresAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="text-sm text-[var(--muted)] mb-3">Transaction History</div>
        {payments.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No transactions yet</div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Date</th><th>Credits</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.createdAt.toLocaleDateString()}</td>
                  <td>+{formatCredits(p.credits)}</td>
                  <td>Rp{p.amountCents.toLocaleString('id-ID')}</td>
                  <td>
                    <span className={p.status === 'paid' ? 'badge badge-active' : 'badge'}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
