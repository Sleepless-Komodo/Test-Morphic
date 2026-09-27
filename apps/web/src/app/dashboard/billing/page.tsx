import { eq, desc, and, gt } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireUser } from '@/lib/actions';
import { getBalance } from '@morphic/db/billing';
import { fetchBackendApi } from '@/lib/api-client';
import { BillingView } from './billing-view';

/** Balance from the gateway, with the direct read as the availability fallback. */
async function loadBalance(userId: string): Promise<number> {
  try {
    const balRes = await fetchBackendApi<{ credits: number }>('/v1/account/balance');
    if (balRes.data?.credits != null) return balRes.data.credits;
    return await getBalance(userId);
  } catch {
    try {
      return await getBalance(userId);
    } catch {
      return 0;
    }
  }
}

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
    // Balance and the ledger used to be awaited after this wave, adding two serial round
    // trips to the gateway for data that depends on nothing here.
    const [pkgRes, entRes, payRes, balanceValue, ledgerRes] = await Promise.all([
      fetchBackendApi<{ data: any[] }>('/v1/catalog/packages'),
      fetchBackendApi<{ data: any[] }>('/v1/account/entitlements'),
      fetchBackendApi<{ data: any[] }>('/v1/account/payments?limit=20'),
      loadBalance(user.id),
      fetchBackendApi<{ data: any[]; total: number }>('/v1/account/transactions?limit=50'),
    ]);
    if (pkgRes.data?.data) displayPackages = pkgRes.data.data;
    if (entRes.data?.data) entitlements = entRes.data.data;
    if (payRes.data?.data) payments = payRes.data.data;
    balance = balanceValue;
    if (ledgerRes.data?.data) ledger = ledgerRes.data.data;

    // Ensure modelDisplayName and modelPublicId are present for model-tied packages
    if (displayPackages.some((p) => p.modelId && !p.modelDisplayName)) {
      try {
        const modelRows = await db
          .select({
            id: s.models.id,
            displayName: s.models.displayName,
            publicModelId: s.models.publicModelId,
          })
          .from(s.models);
        const modelMap = new Map(modelRows.map((m) => [m.id, m]));
        displayPackages = displayPackages.map((p) => {
          if (p.modelId && modelMap.has(p.modelId)) {
            const m = modelMap.get(p.modelId)!;
            return { ...p, modelDisplayName: m.displayName, modelPublicId: m.publicModelId };
          }
          return p;
        });
      } catch {
        // ignore enrichment error
      }
    }
  } catch (err) {
    console.warn('[BillingPage] Backend API fetch failed, will use DB fallback:', err);
  }

  try {
    const needDb = displayPackages.length === 0 || entitlements.length === 0 || payments.length === 0;
    if (!needDb) throw { __skip: true };
    const [dbPackages, dbEntitlements, dbPayments] = await Promise.all([
      db
        .select({
          id: s.packages.id,
          name: s.packages.name,
          description: s.packages.description,
          creditAllowance: s.packages.creditAllowance,
          modelId: s.packages.modelId,
          durationHours: s.packages.durationHours,
          priceCents: s.packages.priceCents,
          currency: s.packages.currency,
          status: s.packages.status,
          modelDisplayName: s.models.displayName,
          modelPublicId: s.models.publicModelId,
        })
        .from(s.packages)
        .leftJoin(s.models, eq(s.packages.modelId, s.models.id))
        .where(eq(s.packages.status, 'active')),
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
    if (displayPackages.length === 0 && dbPackages.length > 0) displayPackages = dbPackages;
    if (entitlements.length === 0) entitlements = dbEntitlements;
    if (payments.length === 0) payments = dbPayments;
  } catch (err: any) {
    if (!err?.__skip) console.warn('[BillingPage] Database fallback unavailable:', err);
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
