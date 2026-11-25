export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { getSessionSafe } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import ModelsExplorer from '@/components/ModelsExplorer';
import Footer from '@/components/Footer';
import { AutoRefresh } from '@/components/AutoRefresh';
import { memo } from '@/lib/memo';
import { makerFromId } from '@/lib/model-maker';
import { joinNames, loadPublicModels, makersOf } from '@/lib/models-data';
import { buildCatalog, type CatalogModel, type SnapshotModel } from '@/lib/model-catalog';
import snapshot from '@/data/model-catalog.json';
import { LIVE_TTL_MS } from '@/lib/refresh';

export async function generateMetadata() {
  const models = await loadPublicModels()
    .then((l) => l.models)
    .catch(() => null);
  const makers = makersOf(models ?? []);
  return {
    title: 'Models Catalog | Morphic AI Gateway',
    description: makers.length
      ? `Jelajahi ${models!.length} model AI dari ${joinNames(makers, false)} lewat satu endpoint OpenAI-compatible.`
      : 'Jelajahi model AI yang aktif di Morphic lewat satu endpoint OpenAI-compatible.',
  };
}

const HOURS = 24;

/** Our active models with their real traffic: 7-day tokens and 24 hourly success buckets. */
async function loadCatalog(): Promise<CatalogModel[]> {
  const [models, volume, hourly] = await Promise.all([
    db
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
      })
      .from(s.models)
      .innerJoin(s.providers, eq(s.models.providerId, s.providers.id))
      .where(eq(s.models.status, 'active')),
    db
      .select({
        modelId: s.requestLogs.resolvedModelId,
        // Tokens only count when a request succeeded; a failed call processed nothing.
        tokens: sql<number>`coalesce(sum(coalesce(${s.requestLogs.promptTokens},0) + coalesce(${s.requestLogs.completionTokens},0)) filter (where ${s.requestLogs.status} = 'success'),0)::bigint`,
      })
      .from(s.requestLogs)
      .where(sql`${s.requestLogs.createdAt} > now() - interval '7 days'`)
      .groupBy(s.requestLogs.resolvedModelId),
    db
      .select({
        modelId: s.requestLogs.resolvedModelId,
        // 0 = current hour, HOURS-1 = oldest
        ago: sql<number>`floor(extract(epoch from (now() - ${s.requestLogs.createdAt})) / 3600)::int`,
        total: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${s.requestLogs.status} = 'error')::int`,
      })
      .from(s.requestLogs)
      .where(sql`${s.requestLogs.createdAt} > now() - interval '${sql.raw(String(HOURS))} hours'`)
      .groupBy(sql`1, 2`),
  ]);
  const tokensBy = new Map(volume.map((v) => [v.modelId, Number(v.tokens)]));
  const bucketsBy = new Map<string, { total: number; errors: number }[]>();
  for (const h of hourly) {
    if (!h.modelId || h.ago < 0 || h.ago >= HOURS) continue;
    const buckets = bucketsBy.get(h.modelId) ?? Array.from({ length: HOURS }, () => ({ total: 0, errors: 0 }));
    buckets[HOURS - 1 - h.ago] = { total: h.total, errors: h.errors };
    bucketsBy.set(h.modelId, buckets);
  }

  // Upstream providers stay on the server; the page only learns about the model.
  const live = models.map(({ id, ...m }) => ({
    ...m,
    capabilities: m.capabilities ?? [],
    maker: makerFromId(m.publicModelId),
    tokens7d: tokensBy.get(id) ?? 0,
    hourly: bucketsBy.get(id) ?? Array.from({ length: HOURS }, () => ({ total: 0, errors: 0 })),
  }));
  return buildCatalog(snapshot.models as SnapshotModel[], live);
}

export default async function ModelsPage() {
  // Session and catalog in parallel. The catalog is the same for every visitor, so concurrent
  // renders share one query for 90s; AutoRefresh keeps an open tab current.
  // An unreachable DB shows an empty catalog rather than models we cannot serve.
  const [session, models] = await Promise.all([
    headers()
      .then((h) => getSessionSafe(h))
      .catch((err) => {
        console.warn('[ModelsPage] Session check failed, rendering as guest:', err);
        return null;
      }),
    memo('public:models', LIVE_TTL_MS, loadCatalog).catch((err) => {
      console.warn('[ModelsPage] Catalog read failed:', err);
      return [] as CatalogModel[];
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white flex flex-col justify-between overflow-x-clip">
      <Navbar session={session} />
      <ModelsExplorer models={models} />
      <AutoRefresh />
      <Footer />
    </main>
  );
}
