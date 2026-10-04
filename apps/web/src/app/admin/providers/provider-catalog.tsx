'use client';

import { memo, useDeferredValue, useMemo, useState } from 'react';
import { RefreshCw, Loader2, Search, AlertTriangle } from 'lucide-react';
import { fetchAllProviderCatalogs } from '@/lib/admin-actions';
import { modelFamily, modelVariants, type CatalogModel, type CatalogResult } from '@/lib/provider-catalog';

type Row = CatalogModel & { provider: string };
type Indexed = Row & { hay: string; family: string; variants: string[] };
type SortKey = 'input' | 'output' | 'context' | 'id';

const PAGE = 100;

const usd = (n: number | null) =>
  n === null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
const tokens = (n: number | null) =>
  n === null ? '—' : n >= 1024 * 1024 ? `${+(n / 1048576).toFixed(1)}M` : n >= 1024 ? `${Math.round(n / 1024)}K` : String(n);

// Rows without a published price go last whichever price we sort by.
const byPrice = (k: 'inputPerM' | 'outputPerM') => (a: Row, b: Row) =>
  (a[k] ?? Infinity) - (b[k] ?? Infinity);
const SORTS: Record<SortKey, (a: Row, b: Row) => number> = {
  input: byPrice('inputPerM'),
  output: byPrice('outputPerM'),
  context: (a, b) => (b.context ?? 0) - (a.context ?? 0),
  id: (a, b) => a.id.localeCompare(b.id),
};

const control =
  'px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950';
const cell = 'py-2 px-3 text-right font-mono tabular-nums';

const CatalogRow = memo(function CatalogRow({
  r,
  showProvider,
  cheapIn,
  cheapOut,
}: {
  r: Row;
  showProvider: boolean;
  cheapIn: boolean;
  cheapOut: boolean;
}) {
  return (
    <tr className="hover:bg-neutral-50/60">
      <td className="py-2 px-3 font-mono text-neutral-900 break-all">{r.id}</td>
      {showProvider && <td className="py-2 px-3 font-semibold text-neutral-700">{r.provider}</td>}
      <td className={`${cell} ${cheapIn ? 'text-emerald-700 font-bold' : 'text-neutral-800'}`}>{usd(r.inputPerM)}</td>
      <td className={`${cell} text-neutral-500`}>{usd(r.cacheReadPerM)}</td>
      <td className={`${cell} ${cheapOut ? 'text-emerald-700 font-bold' : 'text-neutral-800'}`}>{usd(r.outputPerM)}</td>
      <td className={`${cell} text-neutral-600`}>{tokens(r.context)}</td>
      <td className={`${cell} text-neutral-600`}>{tokens(r.maxOutput)}</td>
    </tr>
  );
});

export function CatalogTable({ rows, showProvider }: { rows: Row[]; showProvider: boolean }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('input');
  const [family, setFamily] = useState('all');
  const [variantPick, setVariant] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  // Typing stays responsive; the filter catches up in a lower-priority render.
  const query = useDeferredValue(q);

  // Per-dataset work, done once instead of on every keystroke.
  const indexed = useMemo<Indexed[]>(
    () =>
      rows.map((r) => ({
        ...r,
        hay: `${r.provider} ${r.id}`.toLowerCase(),
        family: modelFamily(r.id),
        variants: modelVariants(r.id),
      })),
    [rows],
  );

  const families = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of indexed) counts.set(r.family, (counts.get(r.family) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [indexed]);

  const inFamily = useMemo(
    () => (family === 'all' ? indexed : indexed.filter((r) => r.family === family)),
    [indexed, family],
  );

  const variants = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of inFamily) for (const v of r.variants) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [inFamily]);
  // A variant from another family falls back to "all" without an extra effect/render.
  const variant = variants.some(([v]) => v === variantPick) ? variantPick : 'all';

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return inFamily
      .filter((r) => (variant === 'all' || r.variants.includes(variant)) && terms.every((t) => r.hay.includes(t)))
      .sort(SORTS[sort]);
  }, [inFamily, variant, query, sort]);

  const { minIn, minOut } = useMemo(() => {
    let minIn = Infinity;
    let minOut = Infinity;
    for (const r of filtered) {
      if (r.inputPerM !== null && r.inputPerM < minIn) minIn = r.inputPerM;
      if (r.outputPerM !== null && r.outputPerM < minOut) minOut = r.outputPerM;
    }
    return { minIn, minOut };
  }, [filtered]);

  const shown = filtered.slice(0, limit);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Cari model</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Cari model, misal: v4.1 flash"
            className={`${control} w-full pl-9`}
          />
        </label>
        <select
          value={family}
          onChange={(e) => {
            setFamily(e.target.value);
            setLimit(PAGE);
          }}
          aria-label="Kategori model"
          className={control}
        >
          <option value="all">Semua kategori ({indexed.length})</option>
          {families.map(([f, n]) => (
            <option key={f} value={f}>
              {f} ({n})
            </option>
          ))}
        </select>
        <select
          value={variant}
          onChange={(e) => {
            setVariant(e.target.value);
            setLimit(PAGE);
          }}
          aria-label="Varian model"
          disabled={variants.length === 0}
          className={`${control} disabled:opacity-50`}
        >
          <option value="all">Semua varian</option>
          {variants.map(([v, n]) => (
            <option key={v} value={v}>
              {v} ({n})
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Urutkan" className={control}>
          <option value="input">Input termurah</option>
          <option value="output">Output termurah</option>
          <option value="context">Context terbesar</option>
          <option value="id">Nama</option>
        </select>
      </div>

      <div className="text-[11px] text-neutral-500 font-mono">
        {filtered.length} model. Harga USD per 1M token, langsung dari API provider.
      </div>

      <div
        className={`overflow-x-auto rounded-xl border border-neutral-200/80 ${query !== q ? 'opacity-70' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="bg-neutral-50/70 border-b border-neutral-200/80">
            <tr className="text-neutral-500 font-mono uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3 text-left font-semibold">Model</th>
              {showProvider && <th className="py-2.5 px-3 text-left font-semibold">Provider</th>}
              <th className="py-2.5 px-3 text-right font-semibold">Input</th>
              <th className="py-2.5 px-3 text-right font-semibold">Cache read</th>
              <th className="py-2.5 px-3 text-right font-semibold">Output</th>
              <th className="py-2.5 px-3 text-right font-semibold">Context</th>
              <th className="py-2.5 px-3 text-right font-semibold">Max output</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {shown.map((r) => (
              <CatalogRow
                key={`${r.provider}:${r.id}`}
                r={r}
                showProvider={showProvider}
                cheapIn={r.inputPerM === minIn}
                cheapOut={r.outputPerM === minOut}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showProvider ? 7 : 6} className="py-8 text-center text-neutral-500">
                  Tidak ada model yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="w-full py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-semibold cursor-pointer"
        >
          Tampilkan {Math.min(PAGE, filtered.length - limit)} lagi ({filtered.length - limit} tersisa)
        </button>
      )}
      <p className="text-[11px] text-neutral-500">
        Hijau = harga termurah di hasil filter. &quot;—&quot; berarti API provider tidak mencantumkan harga.
      </p>
    </div>
  );
}

/** Live models and prices across every saved provider, for comparing who is cheapest. */
export function ProviderCatalog({ initial }: { initial: Record<string, CatalogResult> }) {
  const [results, setResults] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [only, setOnly] = useState<string>('all');
  const names = Object.keys(results);

  const load = async () => {
    setLoading(true);
    try {
      setResults(await fetchAllProviderCatalogs(true));
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(
    () =>
      Object.entries(results)
        .filter(([name]) => only === 'all' || name === only)
        .flatMap(([provider, r]) => r.models.map((m) => ({ ...m, provider }))),
    [results, only],
  );
  const errors = Object.entries(results).filter(([, r]) => !r.ok);
  const fetchedAt = Object.values(results).map((r) => r.fetchedAt).sort()[0];

  return (
    <section className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-heading font-bold text-neutral-950">Model &amp; harga provider</h2>
          <p className="text-xs text-neutral-500">
            Diambil dari endpoint <code className="font-mono">/models</code> tiap provider, disimpan 5 menit. Refresh untuk data terbaru.
            {fetchedAt && ` Dicek ${new Date(fetchedAt).toLocaleTimeString()}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={only}
            onChange={(e) => setOnly(e.target.value)}
            aria-label="Filter provider"
            className="px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            <option value="all">Semua provider</option>
            {names.map((name) => (
              <option key={name} value={name}>
                {name} {results[name]!.ok ? `(${results[name]!.models.length})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 text-[11px] font-mono text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          {errors.map(([name, r]) => (
            <li key={name} className="flex gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="break-all">
                {name}: {r.error}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={loading ? 'opacity-50 transition-opacity' : undefined} aria-busy={loading}>
        <CatalogTable rows={rows} showProvider={only === 'all'} />
      </div>
    </section>
  );
}

export function ProviderCatalogSkeleton() {
  return (
    <section className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-5 space-y-3 animate-pulse" aria-busy="true">
      <div className="h-5 bg-neutral-200 rounded w-1/4" />
      <div className="h-9 bg-neutral-100 rounded-xl" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-6 bg-neutral-100 rounded" />
      ))}
    </section>
  );
}
