import Link from 'next/link';
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { formatCredits, formatTokenEstimate, timeAgo } from '@/lib/utils';
import { AutoRefresh } from '@/components/AutoRefresh';
import { memo } from '@/lib/memo';
import { LIVE_TTL_MS } from '@/lib/refresh';
import { KeyRound, Search } from 'lucide-react';
import { UserCell } from '../user-cell';
import { PERIODS, parsePeriod, keyStatus } from './period';
import { PAGE_SIZE } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const SORTS = ['requests', 'tokens', 'credits', 'errors', 'last_used', 'created'] as const;
type Sort = (typeof SORTS)[number];

type Params = { period?: string; q?: string; sort?: string; status?: string; page?: string };

export default async function AdminApiKeys({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin('users:read');
  const { locale } = await getServerTranslation();
  const en = locale === 'en';
  const params = await searchParams;
  const { period, since } = parsePeriod(params.period);
  const sort: Sort = SORTS.includes(params.sort as Sort) ? (params.sort as Sort) : 'requests';
  const status = ['active', 'revoked'].includes(params.status ?? '') ? params.status! : 'all';
  const q = (params.q ?? '').trim();
  const page = Math.max(1, Number(params.page) || 1);

  // Both reads are independent of q/sort/status/page: per-key stats are cached once per period and
  // the key list once, then filtered, sorted and paged in memory (bounded by the number of keys).
  const [keys, stats] = await Promise.all([
    memo('admin:apikeys:keys', LIVE_TTL_MS, () =>
      db
        .select({
          id: s.apiKeys.id,
          name: s.apiKeys.name,
          keyPrefix: s.apiKeys.keyPrefix,
          status: s.apiKeys.status,
          expiresAt: s.apiKeys.expiresAt,
          lastUsedAt: s.apiKeys.lastUsedAt,
          createdAt: s.apiKeys.createdAt,
          userName: s.users.name,
          userEmail: s.users.email,
          userImage: s.users.image,
          userRole: s.users.role,
        })
        .from(s.apiKeys)
        .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId)),
    ),
    memo(`admin:apikeys:stats:${period.key}`, LIVE_TTL_MS, () =>
      db
        .select({
          apiKeyId: s.requestLogs.apiKeyId,
          requests: sql<number>`count(*)::int`,
          errors: sql<number>`count(*) filter (where ${s.requestLogs.status} <> 'success')::int`,
          promptTokens: sql<number>`coalesce(sum(${s.requestLogs.promptTokens}), 0)::float8`,
          completionTokens: sql<number>`coalesce(sum(${s.requestLogs.completionTokens}), 0)::float8`,
          credits: sql<number>`coalesce(sum(${s.requestLogs.creditsConsumed}), 0)::float8`,
        })
        .from(s.requestLogs)
        .where(and(isNotNull(s.requestLogs.apiKeyId), since ? gt(s.requestLogs.createdAt, since) : undefined))
        .groupBy(s.requestLogs.apiKeyId),
    ),
  ]);

  // Groups include keys deleted since, exactly like the old count(distinct api_key_id).
  const activity = { keys: stats.length, requests: 0, tokens: 0 };
  const statsByKey = new Map<string, (typeof stats)[number]>();
  for (const r of stats) {
    activity.requests += r.requests;
    activity.tokens += r.promptTokens + r.completionTokens;
    if (r.apiKeyId) statsByKey.set(r.apiKeyId, r);
  }
  const summary = { total: keys.length, active: keys.filter((k) => k.status === 'active').length };

  const needle = q.toLowerCase();
  const matched = keys
    .filter((k) => status === 'all' || k.status === status)
    .filter(
      (k) =>
        !needle ||
        [k.name, k.keyPrefix, k.userEmail, k.userName].some((v) => v?.toLowerCase().includes(needle)),
    )
    .map((k) => {
      const st = statsByKey.get(k.id);
      return {
        ...k,
        requests: st?.requests ?? 0,
        errors: st?.errors ?? 0,
        promptTokens: st?.promptTokens ?? 0,
        completionTokens: st?.completionTokens ?? 0,
        credits: st?.credits ?? 0,
      };
    });
  type Row = (typeof matched)[number];
  const time = (d: Date | null) => d?.getTime() ?? -Infinity;
  const metric: Record<Sort, (r: Row) => number> = {
    requests: (r) => r.requests,
    tokens: (r) => r.promptTokens + r.completionTokens,
    credits: (r) => r.credits,
    errors: (r) => r.errors,
    last_used: (r) => time(r.lastUsedAt),
    created: (r) => r.createdAt.getTime(),
  };
  const by = metric[sort];
  matched.sort((a, b) => by(b) - by(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rows = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const href = (patch: Partial<Params>) => {
    const n = { period: period.key, q, sort, status, page: String(page), ...patch };
    const sp = new URLSearchParams({ period: n.period });
    if (n.q) sp.set('q', n.q);
    if (n.sort !== 'requests') sp.set('sort', n.sort);
    if (n.status !== 'all') sp.set('status', n.status);
    if (n.page !== '1') sp.set('page', n.page);
    return `/admin/api-keys?${sp}`;
  };

  const tile = 'rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-2xs';
  const label = 'text-xs font-semibold text-neutral-500';
  const th = 'py-3 px-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-neutral-500';
  const sortLink = (key: Sort, text: string) => (
    <Link
      href={href({ sort: key, page: '1' })}
      scroll={false}
      aria-current={sort === key ? 'true' : undefined}
      className={sort === key ? 'text-neutral-950 underline underline-offset-4' : 'hover:text-neutral-950'}
    >
      {text}
    </Link>
  );

  return (
    <div className="w-full space-y-6">
      <AutoRefresh />
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl">
            <KeyRound className="h-5 w-5 text-neutral-700" />
            {en ? 'API Keys' : 'API Key'}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
            {en
              ? 'Every key, who owns it, and what it has been doing. Click a key for its full request history.'
              : 'Semua key, siapa pemiliknya, dan dipakai untuk apa. Klik key untuk riwayat request lengkapnya.'}
          </p>
        </div>
        <nav aria-label={en ? 'Period' : 'Periode'} className="inline-flex rounded-xl border border-neutral-200 bg-white p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={href({ period: p.key, page: '1' })}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={tile}>
          <div className={label}>{en ? 'Keys' : 'Total key'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{formatCredits(summary.total)}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">{formatCredits(summary.active)} {en ? 'active' : 'aktif'}</div>
        </div>
        <div className={tile}>
          <div className={label}>{en ? 'Keys used' : 'Key terpakai'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{formatCredits(activity.keys)}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">{en ? period.en : period.id}</div>
        </div>
        <div className={tile}>
          <div className={label}>{en ? 'Requests' : 'Request'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{formatCredits(activity.requests)}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">{en ? period.en : period.id}</div>
        </div>
        <div className={tile}>
          <div className={label}>Token</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{formatTokenEstimate(activity.tokens)}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">input + output</div>
        </div>
      </div>

      <form action="/admin/api-keys" className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input type="hidden" name="period" value={period.key} />
        <input type="hidden" name="sort" value={sort} />
        <label className="relative">
          <span className="sr-only">{en ? 'Search' : 'Cari'}</span>
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            name="q"
            defaultValue={q}
            placeholder={en ? 'Key name, prefix, owner email or name' : 'Nama key, prefix, email atau nama pemilik'}
            className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          />
        </label>
        <select
          name="status"
          defaultValue={status}
          aria-label="Status"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
        >
          <option value="all">{en ? 'All statuses' : 'Semua status'}</option>
          <option value="active">{en ? 'Active' : 'Aktif'}</option>
          <option value="revoked">{en ? 'Revoked' : 'Dicabut'}</option>
        </select>
        <button type="submit" className="rounded-xl bg-neutral-950 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800">
          {en ? 'Apply' : 'Terapkan'}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
              <tr>
                <th className={`${th} text-left px-4`}>Key</th>
                <th className={`${th} text-left`}>{en ? 'Owner' : 'Pemilik'}</th>
                <th className={`${th} text-right`}>{sortLink('requests', 'Req')}</th>
                <th className={`${th} text-right`}>{sortLink('errors', en ? 'Failed' : 'Gagal')}</th>
                <th className={`${th} text-right`}>{sortLink('tokens', 'Token in / out')}</th>
                <th className={`${th} text-right`}>{sortLink('credits', en ? 'Credits' : 'Kredit')}</th>
                <th className={`${th} text-right px-4`}>{sortLink('last_used', en ? 'Last used' : 'Terakhir dipakai')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => {
                const st = keyStatus(r);
                return (
                  <tr key={r.id} className="transition-colors hover:bg-neutral-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/api-keys/${r.id}?period=${period.key}`} className="group block min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-neutral-950 group-hover:underline underline-offset-4">{r.name}</span>
                          {st !== 'active' && (
                            <span className="rounded border border-neutral-300 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-neutral-500">
                              {st}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-neutral-500">{r.keyPrefix}…</div>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <UserCell name={r.userName} email={r.userEmail} image={r.userImage} role={r.userRole} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-neutral-950">{formatCredits(r.requests ?? 0)}</td>
                    <td className={`px-3 py-3 text-right font-mono tabular-nums ${(r.errors ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-neutral-400'}`}>
                      {formatCredits(r.errors ?? 0)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">
                      {formatTokenEstimate(r.promptTokens ?? 0)} / {formatTokenEstimate(r.completionTokens ?? 0)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-neutral-700">{formatTokenEstimate(r.credits ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-neutral-600 whitespace-nowrap">
                      {r.lastUsedAt ? timeAgo(r.lastUsedAt, locale) : en ? 'Never' : 'Belum pernah'}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-500">
                    {en ? 'No keys match.' : 'Tidak ada key yang cocok.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <nav aria-label={en ? 'Pages' : 'Halaman'} className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">
            {en ? 'Page' : 'Halaman'} {page} / {pages} · {formatCredits(matched.length)} key
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: String(page - 1) })} className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 font-semibold hover:bg-neutral-100">
                {en ? 'Previous' : 'Sebelumnya'}
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: String(page + 1) })} className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 font-semibold hover:bg-neutral-100">
                {en ? 'Next' : 'Berikutnya'}
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
