// Public catalog = the active models in our database. The static snapshot (src/data/model-catalog.json,
// see scripts/sync-model-catalog.mjs) only adds metadata we do not store: maker logo, modalities, max output.
export interface SnapshotModel {
  slug: string;
  name: string;
  maker: string;
  makerLogo: string | null;
  description: string | null;
  aliases: string[];
  input: string[];
  output: string[];
  contextLength: number | null;
  maxOutput: number | null;
  inputUsd: [number, number] | null;
  outputUsd: [number, number] | null;
  reasoning: boolean;
  published: string | null;
  providers: { name: string; logo: string | null }[];
}

export interface LiveModel {
  publicModelId: string;
  providerModelId: string;
  displayName: string;
  description: string | null;
  contextLength: number;
  capabilities: string[];
  inputCreditsPer1m: number;
  outputCreditsPer1m: number;
  maker: string;
  tokens7d: number;
  hourly: { total: number; errors: number }[];
}

export interface CatalogModel {
  /** The id a client sends. */
  id: string;
  name: string;
  maker: string;
  makerLogo: string | null;
  description: string | null;
  input: string[];
  output: string[];
  contextLength: number | null;
  maxOutput: number | null;
  /** What Morphic bills, in credits per 1M tokens. */
  price: { input: number; output: number };
  tokens7d: number;
  /** Oldest → newest, one bucket per hour over the last 24h. */
  hourly: { total: number; errors: number }[];
}

const key = (s: string) => s.trim().toLowerCase();

/** Exact matches only: slug, slug without the maker prefix, or a listed alias. */
export function matchSnapshot(live: Pick<LiveModel, 'publicModelId' | 'providerModelId'>, snapshot: SnapshotModel[]): SnapshotModel | undefined {
  const ids = new Set([key(live.publicModelId), key(live.providerModelId)]);
  return snapshot.find(
    (m) => ids.has(key(m.slug)) || ids.has(key(m.slug.split('/').pop()!)) || m.aliases.some((a) => ids.has(key(a))),
  );
}

/** One entry per model in the database. The snapshot only fills in metadata we do not store. */
export function buildCatalog(snapshot: SnapshotModel[], live: LiveModel[]): CatalogModel[] {
  const logoByName = new Map(snapshot.flatMap((m) => [[key(m.maker), m.makerLogo] as const]));
  return live.map((l) => {
    const snap = matchSnapshot(l, snapshot);
    return {
      id: l.publicModelId,
      name: l.displayName,
      maker: snap?.maker ?? l.maker,
      makerLogo: snap?.makerLogo ?? logoByName.get(key(l.maker)) ?? null,
      description: l.description?.trim() || snap?.description || null,
      input: snap?.input ?? ['text'],
      output: snap?.output ?? ['text'],
      contextLength: l.contextLength,
      maxOutput: snap?.maxOutput ?? null,
      price: { input: l.inputCreditsPer1m, output: l.outputCreditsPer1m },
      tokens7d: l.tokens7d,
      hourly: l.hourly,
    };
  });
}
