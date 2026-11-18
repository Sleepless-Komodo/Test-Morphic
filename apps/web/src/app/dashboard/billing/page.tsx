import { eq, asc, and, gt } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { getLedgerPageAction, getOwnBalance, getPaymentsPageAction, requireUser } from '@/lib/actions';
import { readyModelIds } from '@morphic/shared/model-readiness';
import { BillingView } from './billing-view';
import { hasStoredCredentials, loadPublicModels } from '@/lib/models-data';
import { memo } from '@/lib/memo';
import { LIVE_TTL_MS } from '@/lib/refresh';

/** Four routable models spread from cheapest to dearest output, for the "how far do N tokens go" strip.
 *  The same for every user, so one read serves all billing pages for a while. */
const loadShowcase = () => memo('dashboard:model-showcase', LIVE_TTL_MS, async () => {
  const [models, providers, pool] = await Promise.all([
    db
      .select({
        id: s.models.id,
        providerId: s.models.providerId,
        fallbackProviderId: s.models.fallbackProviderId,
        publicModelId: s.models.publicModelId,
        name: s.models.displayName,
        out: s.models.outputCreditsPer1m,
      })
      .from(s.models)
      .where(eq(s.models.status, 'active')),
    // Credential columns only decide readiness; they never reach the page.
    db
      .select({
        id: s.providers.id,
        status: s.providers.status,
        encryptedCredentials: hasStoredCredentials,
        credentialReference: s.providers.credentialReference,
      })
      .from(s.providers),
    db
      .select({ modelId: s.modelProviderPool.modelId, providerId: s.modelProviderPool.providerId, isEnabled: s.modelProviderPool.isEnabled })
      .from(s.modelProviderPool),
  ]);
  const ids = readyModelIds(models, providers, pool);
  // Skip near-free local models: "10M tokens buy 100 billion" would only mislead.
  const ready = models.filter((m) => ids.has(m.id) && m.out >= 1_000_000).sort((a, b) => a.out - b.out);
  const picks = ready.length <= 4 ? ready : [0, 1, 2, 3].map((i) => ready[Math.round((i * (ready.length - 1)) / 3)]!);
  return picks.map((m) => ({ id: m.publicModelId, name: m.name, out: m.out }));
});

export default async function BillingPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const initialTab =
    searchParams?.tab === 'payments' || searchParams?.tab === 'ledger'
      ? searchParams.tab
      : 'packages';
  const user = await requireUser();

  // Read straight from Postgres. These reads used to go through the gateway, whose
  // matching endpoints run exactly these queries against the same rows, so each one cost an
  // HTTPS round trip to another region for data this process can already reach. The gateway
  // still owns every write (minting keys, redeeming codes, creating payments).
  const [balance, packages, entitlements, payments, ledger, showcase, sampleModelId] = await Promise.all([
    getOwnBalance().then((b) => b.credits).catch((err) => {
      console.warn('[BillingPage] Balance read failed:', err);
      return 0;
    }),
    db
      .select({
        id: s.packages.id,
        name: s.packages.name,
        kind: s.packages.kind,
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
      .where(eq(s.packages.status, 'active'))
      .orderBy(asc(s.packages.priceCents))
      .catch((err) => {
        console.warn('[BillingPage] Package catalogue read failed:', err);
        return [] as any[];
      }),
    db
      .select({
        id: s.entitlements.id,
        allowance: s.entitlements.allowance,
        remaining: s.entitlements.remaining,
        unlimited: s.entitlements.unlimited,
        resetsAt: s.entitlements.resetsAt,
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
      )
      .catch((err) => {
        console.warn('[BillingPage] Entitlement read failed:', err);
        return [] as any[];
      }),
    // Older rows load in the view through the same actions, one list at a time.
    getPaymentsPageAction().catch((err) => {
      console.warn('[BillingPage] Payment history read failed:', err);
      return { data: [], nextCursor: null };
    }),
    getLedgerPageAction().catch((err) => {
      console.warn('[BillingPage] Credit ledger read failed:', err);
      return { data: [], nextCursor: null };
    }),
    // Real multipliers for the "how far do 10M tokens go" strip, cheap to expensive.
    loadShowcase().catch(() => [] as { id: string; name: string; out: number }[]),
    // Setup snippets after a top-up name a model we really serve.
    loadPublicModels()
      .then((l) => l.models[0]?.id ?? null)
      .catch(() => null),
  ]);

  return (
    <BillingView
      balance={balance}
      packages={packages}
      entitlements={entitlements}
      payments={payments}
      ledger={ledger}
      showcase={showcase}
      sampleModelId={sampleModelId}
      initialTab={initialTab}
    />
  );
}
