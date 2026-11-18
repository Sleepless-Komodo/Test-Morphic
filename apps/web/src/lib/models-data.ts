// The active models a visitor can call, read from the database. Pages that name models in copy,
// metadata or code samples use this instead of a hardcoded list, so they never advertise a model
// we do not route.
import { eq, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { memo } from './memo';
import { SLOW_TTL_MS } from './refresh';
import { makerByPrefix, makerFromId } from './model-maker';
import { matchSnapshot, type SnapshotModel } from './model-catalog';
import snapshot from '@/data/model-catalog.json';

export interface PublicModel {
  id: string;
  name: string;
  maker: string;
  makerLogo: string | null;
  contextLength: number;
}

export interface PublicModelList {
  /** By name. No traffic ordering: that would read request_logs on every page that lists models. */
  models: PublicModel[];
  /** Active providers that serve at least one active model (primary, enabled pool entry or fallback). */
  providerCount: number;
}

const catalog = snapshot.models as SnapshotModel[];

/** Readiness only needs to know a key is stored. This returns a marker instead of shipping the encrypted blob
 *  over the wire; '' stays falsy, matching providerUsable's Boolean() check. */
export const hasStoredCredentials = sql<string | null>`case when nullif(${s.providers.encryptedCredentials}, '') is not null then 'set' end`;
const logoByMaker = new Map(catalog.map((m) => [m.maker.toLowerCase(), m.makerLogo]));

export const loadPublicModels = () =>
  memo('public:model-list', SLOW_TTL_MS, async (): Promise<PublicModelList> => {
    const [rows, pool, providers] = await Promise.all([
      db
        .select({
          id: s.models.publicModelId,
          providerModelId: s.models.providerModelId,
          name: s.models.displayName,
          contextLength: s.models.contextLength,
          modelId: s.models.id,
          providerId: s.models.providerId,
          fallbackProviderId: s.models.fallbackProviderId,
        })
        .from(s.models)
        .where(eq(s.models.status, 'active')),
      db
        .select({ modelId: s.modelProviderPool.modelId, providerId: s.modelProviderPool.providerId })
        .from(s.modelProviderPool)
        .where(eq(s.modelProviderPool.isEnabled, true)),
      db.select({ id: s.providers.id }).from(s.providers).where(eq(s.providers.status, 'active')),
    ]);

    const activeModelIds = new Set(rows.map((r) => r.modelId));
    const activeProviders = new Set(providers.map((p) => p.id));
    const serving = new Set(
      [
        ...rows.flatMap((r) => [r.providerId, r.fallbackProviderId]),
        ...pool.filter((p) => activeModelIds.has(p.modelId)).map((p) => p.providerId),
      ].filter((id): id is string => !!id && activeProviders.has(id)),
    );

    const models = rows
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => {
        const snap = matchSnapshot({ publicModelId: r.id, providerModelId: r.providerModelId }, catalog);
        const maker = snap?.maker ?? makerFromId(r.id);
        return {
          id: r.id,
          name: r.name,
          maker,
          makerLogo: snap?.makerLogo ?? makerByPrefix(r.id)?.logo ?? logoByMaker.get(maker.toLowerCase()) ?? null,
          contextLength: r.contextLength,
        };
      });
    return { models, providerCount: serving.size };
  });

/** Distinct makers in list order, without the catch-all bucket. */
export const makersOf = (models: PublicModel[]) => [...new Set(models.map((m) => m.maker))].filter((m) => m !== 'Other');

/** "A, B, and C" / "A, B, dan C". */
export function joinNames(names: string[], en: boolean): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${en ? 'and' : 'dan'} ${names.at(-1)}`;
}
