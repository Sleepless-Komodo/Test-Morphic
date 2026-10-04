import Link from 'next/link';
import { Suspense } from 'react';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { fetchAllProviderCatalogs } from '@/lib/admin-actions';
import { formatCredits, formatTokenEstimate } from '@/lib/utils';
import { IDR_PER_USD, rupiah } from '@/lib/money';
import { costIdr, findPrice, margin, rupiahPerCredit } from '@/lib/margin';
import { loadMarginUsage, loadSales } from '@/lib/admin-insights';
import { AutoRefresh } from '@/components/AutoRefresh';
import { TrendingUp } from 'lucide-react';
import { PERIODS, parsePeriod } from '../api-keys/period';

export const dynamic = 'force-dynamic';

async function MarginTable({ since, en }: { since: Date | null; en: boolean }) {
  const [sales, usage, catalogs] = await Promise.all([loadSales(), loadMarginUsage(since), fetchAllProviderCatalogs()]);

  const rpc = rupiahPerCredit(sales.idr, sales.credits);
  const rows = usage
    .map((u) => {
      const price = u.provider && u.providerModelId ? findPrice(catalogs[u.provider]?.models, u.providerModelId) : null;
      const revenue = rpc === null ? null : u.credits * rpc;
      const cost = costIdr(u.prompt, u.completion, price, IDR_PER_USD);
      return { ...u, price, revenue, cost, ...margin(revenue, cost) };
    })
    // Losses first; rows we can't price go last.
    .sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity));

  const known = rows.filter((r) => r.margin !== null);
  const totalRevenue = rows.reduce((a, r) => a + (r.revenue ?? 0), 0);
  const knownRevenue = known.reduce((a, r) => a + r.revenue!, 0);
  const knownCost = known.reduce((a, r) => a + r.cost!, 0);
  const totalMargin = margin(knownRevenue, knownCost);
  const losing = known.filter((r) => r.margin! < 0).length;

  const tile = 'rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-2xs';
  const label = 'text-xs font-semibold text-neutral-500';
  const th = 'py-3 px-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-neutral-500';
  const num = 'py-2.5 px-3 text-right font-mono tabular-nums';

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={tile}>
          <div className={label}>{en ? 'Revenue (estimated)' : 'Pendapatan (estimasi)'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{rupiah(totalRevenue)}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            {rpc === null ? (en ? 'No paid top-ups yet' : 'Belum ada top up lunas') : `${rupiah(rpc)}/${en ? 'credit' : 'kredit'}`}
          </div>
        </div>
        <div className={tile}>
          <div className={label}>{en ? 'Provider cost' : 'Biaya provider'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{rupiah(knownCost)}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            {known.length}/{rows.length} {en ? 'rows priced' : 'baris ada harganya'}
          </div>
        </div>
        <div className={tile}>
          <div className={label}>Margin</div>
          <div className={`mt-1 text-2xl font-extrabold tabular-nums ${(totalMargin.margin ?? 0) < 0 ? 'text-red-600' : 'text-neutral-950'}`}>
            {totalMargin.margin === null ? '—' : rupiah(totalMargin.margin)}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            {totalMargin.pct === null ? '—' : `${totalMargin.pct.toFixed(1)}%`} {en ? 'of priced revenue' : 'dari pendapatan yang ada harganya'}
          </div>
        </div>
        <div className={tile}>
          <div className={label}>{en ? 'Losing rows' : 'Baris rugi'}</div>
          <div className={`mt-1 text-2xl font-extrabold tabular-nums ${losing > 0 ? 'text-red-600' : 'text-neutral-950'}`}>{losing}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">{en ? 'model + provider pairs' : 'pasangan model + provider'}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
              <tr>
                <th className={`${th} text-left px-4`}>Model</th>
                <th className={`${th} text-left`}>Provider</th>
                <th className={`${th} text-right`}>Req</th>
                <th className={`${th} text-right`}>Token in / out</th>
                <th className={`${th} text-right`}>{en ? 'Credits' : 'Kredit'}</th>
                <th className={`${th} text-right`}>{en ? 'Revenue' : 'Pendapatan'}</th>
                <th className={`${th} text-right`}>{en ? 'Cost' : 'Biaya'}</th>
                <th className={`${th} text-right px-4`}>Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={`${r.model}:${r.provider}:${r.providerModelId}`} className={r.margin !== null && r.margin < 0 ? 'bg-red-50/60' : 'hover:bg-neutral-50/60'}>
                  <td className="px-4 py-2.5">
                    <div className="font-mono font-semibold text-neutral-950 break-all">{r.model}</div>
                    {r.providerModelId && r.providerModelId !== r.model && (
                      <div className="font-mono text-[11px] text-neutral-500 break-all">{r.providerModelId}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-neutral-700">{r.provider ?? '—'}</td>
                  <td className={`${num} text-neutral-950 font-semibold`}>{formatCredits(r.requests)}</td>
                  <td className={`${num} text-neutral-700`}>
                    {formatTokenEstimate(r.prompt)} / {formatTokenEstimate(r.completion)}
                  </td>
                  <td className={`${num} text-neutral-700`}>{formatTokenEstimate(r.credits)}</td>
                  <td className={`${num} text-neutral-800`}>{r.revenue === null ? '—' : rupiah(r.revenue)}</td>
                  <td className={`${num} text-neutral-800`} title={r.price ? `$${r.price.inputPerM ?? '?'} / $${r.price.outputPerM ?? '?'} per 1M` : undefined}>
                    {r.cost === null ? (
                      <span className="text-neutral-400">{en ? 'unknown' : 'tidak diketahui'}</span>
                    ) : (
                      rupiah(r.cost)
                    )}
                  </td>
                  <td className={`${num} px-4 font-bold ${r.margin === null ? 'text-neutral-400' : r.margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {r.margin === null ? '—' : rupiah(r.margin)}
                    {r.pct !== null && <div className="text-[11px] font-semibold">{r.pct.toFixed(1)}%</div>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-500">
                    {en ? 'No successful requests in this period.' : 'Belum ada request sukses di periode ini.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-500">
        {en
          ? `Revenue = credits used x average Rupiah paid per credit sold (all paid top-ups, USD at ${rupiah(IDR_PER_USD)}/$). Free credits from codes and promotions are valued the same, so this is an estimate. Cost = tokens x the provider's live price from its /models endpoint for the exact model id we send it. "Unknown" means that provider doesn't publish a price for it.`
          : `Pendapatan = kredit terpakai x rata-rata Rupiah yang dibayar per kredit terjual (semua top up lunas, USD dihitung ${rupiah(IDR_PER_USD)}/$). Kredit gratis dari kode dan promo dihitung sama, jadi ini estimasi. Biaya = token x harga live provider dari endpoint /models untuk model id yang kita kirim. "Tidak diketahui" berarti provider itu tidak mencantumkan harganya.`}
      </p>
    </>
  );
}

function MarginSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-neutral-200/80 bg-white" />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-neutral-200/80 bg-white" />
    </div>
  );
}

export default async function AdminMargin({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const { locale } = await getServerTranslation();
  const en = locale === 'en';
  const { period, since } = parsePeriod((await searchParams).period);

  return (
    <div className="max-w-6xl space-y-6">
      <AutoRefresh intervalMs={60_000} />
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl">
            <TrendingUp className="h-5 w-5 text-neutral-700" />
            {en ? 'Margin' : 'Margin & profit'}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
            {en
              ? 'What each model and provider earns versus what it costs upstream. Losses first.'
              : 'Pendapatan tiap model dan provider dibanding biaya ke provider. Yang rugi paling atas.'}
          </p>
        </div>
        <nav aria-label={en ? 'Period' : 'Periode'} className="inline-flex rounded-xl border border-neutral-200 bg-white p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/admin/margin?period=${p.key}`}
              scroll={false}
              aria-current={p.key === period.key ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                p.key === period.key ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              {en ? p.en : p.id}
            </Link>
          ))}
        </nav>
      </div>

      <Suspense key={period.key} fallback={<MarginSkeleton />}>
        <MarginTable since={since} en={en} />
      </Suspense>
    </div>
  );
}
