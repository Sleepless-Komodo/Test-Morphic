import { eq, desc, and, gt } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireUser } from '@/lib/actions';
import { getBalance } from '@morphic/db/billing';
import { fetchBackendApi } from '@/lib/api-client';
import { BillingView } from './billing-view';

export default async function BillingPage() {
  const user = await requireUser();
  let balance = 0;
  let displayPackages: any[] = [];
  let entitlements: any[] = [];
  let payments: any[] = [];
  let ledger: any[] = [];

  // Prefer the live API for every user-scoped list; direct DB below is the availability
  // fallback only (audit M6 — no fabricated data, honest empty state on total failure).
  try {
    const [pkgRes, entRes, payRes] = await Promise.all([
      fetchBackendApi<{ data: any[] }>('/v1/catalog/packages'),
      fetchBackendApi<{ data: any[] }>('/v1/account/entitlements'),
      fetchBackendApi<{ data: any[] }>('/v1/account/payments?limit=20'),
    ]);
    if (pkgRes.data?.data) displayPackages = pkgRes.data.data;
    if (entRes.data?.data) entitlements = entRes.data.data;
    if (payRes.data?.data) payments = payRes.data.data;
  } catch (err) {
    console.warn('[BillingPage] Backend API fetch failed, will use DB fallback:', err);
  }

  try {
    const needDb = displayPackages.length === 0 || entitlements.length === 0 || payments.length === 0;
    if (!needDb) throw { __skip: true };
    const [b, dbPackages, dbEntitlements, dbPayments] = await Promise.all([
      getBalance(user.id),
      db.select().from(s.packages).where(eq(s.packages.status, 'active')),
      db
        .select({
          id: s.entitlements.id,
          allowance: s.entitlements.allowance,
          remaining: s.entitlements.remaining,
          expiresAt: s.entitlements.expiresAt,
          packageName: s.packages.name,
          displayName: s.models.displayName,
        })
        .from(s.entitlements)
        .leftJoin(s.packages, eq(s.entitlements.packageId, s.packages.id))
        .leftJoin(s.models, eq(s.entitlements.modelId, s.models.id))
        .where(
          and(
            eq(s.entitlements.userId, user.id),
            eq(s.entitlements.status, 'active'),
            gt(s.entitlements.expiresAt, new Date()),
          ),
        ),
      db
        .select()
        .from(s.payments)
        .where(eq(s.payments.userId, user.id))
        .orderBy(desc(s.payments.createdAt))
        .limit(20),
    ]);
    balance = b;
    if (displayPackages.length === 0 && dbPackages.length > 0) displayPackages = dbPackages;
    if (entitlements.length === 0) entitlements = dbEntitlements;
    if (payments.length === 0) payments = dbPayments;
  } catch (err: any) {
    if (!err?.__skip) console.warn('[BillingPage] Database fallback unavailable:', err);
  }

  // Balance always via getBalance (cheap) if not already set by API below.

  // Balance: API first, direct getBalance as the availability fallback.
  try {
    const balRes = await fetchBackendApi<{ credits: number }>('/v1/account/balance');
    if (balRes.data?.credits != null) {
      balance = balRes.data.credits;
    } else {
      balance = await getBalance(user.id);
    }
  } catch {
    try { balance = await getBalance(user.id); } catch { balance = 0; }
  }

  // Fetch credit ledger from backend API (authenticated via session cookie forwarding)
  const ledgerRes = await fetchBackendApi<{ data: any[]; total: number }>(
    '/v1/account/transactions?limit=50',
  );
  if (ledgerRes.data?.data) {
    ledger = ledgerRes.data.data;
  }

  return (
    <BillingView
      balance={balance}
      packages={displayPackages}
      entitlements={entitlements}
      payments={payments}
      ledger={ledger}
    />
  );
}
