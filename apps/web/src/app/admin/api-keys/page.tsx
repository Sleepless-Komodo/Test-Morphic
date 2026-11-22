import Link from 'next/link';
import { and, asc, desc, eq, gt, ilike, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { formatCredits, formatTokenEstimate, timeAgo } from '@/lib/utils';
import { AutoRefresh } from '@/components/AutoRefresh';
import { memo } from '@/lib/memo';
import { LIVE_TTL_MS, SLOW_TTL_MS } from '@/lib/refresh';
import { KeyRound, Search } from 'lucide-react';
import { UserCell } from '../user-cell';
import { PERIODS, parsePeriod, keyStatus } from './period';
import { loadPage, readPage } from '@/lib/page-numbers';
import { cappedCount } from '@/lib/capped-count';
import { Pager } from '@/components/Pager';

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
  const pageNo = readPage(params.page);

  // Per-key stats for the period: the only read of request_logs on this page, aggregated once per
  // period and cached (all time for longer), so paging, sorting and searching never scan the log table.
  const statsRows = await memo(`admin:apikeys:stats:${period.key}`, period.ms ? LIVE_TTL_MS : SLOW_TTL_MS, () =>
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
  );
  // Groups include keys deleted since, exactly like the old count(distinct api_key_id).
  const activity = { keys: statsRows.length, requests: 0, tokens: 0 };
  for (const r of statsRows) {
    activity.requests += r.requests;
    activity.tokens += r.promptTokens + r.completionTokens;
  }
  // The cached stats go to the page query as one JSON parameter, joined like a table.
  const statsJson = JSON.stringify(
    statsRows.flatMap((r) =>
      r.apiKeyId ? [{ k: r.apiKeyId, r: r.requests, e: r.errors, p: r.promptTokens, c: r.completionTokens, cr: r.credits }] : [],
    ),
  );
  const stats = sql`jsonb_to_recordset(${statsJson}::jsonb) as key_stats(k uuid, r int, e int, p float8, c float8, cr float8)`;

  const like = q ? `%${q.replace(/[%_\\]/g, '\\$&')}%` : null;
  const where = and(
    status === 'all' ? undefined : eq(s.apiKeys.status, status as 'active' | 'revoked'),
    like
      ? or(ilike(s.apiKeys.name, like), ilike(s.apiKeys.keyPrefix, like), ilike(s.users.email, like), ilike(s.users.name, like))
      : undefined,
  );

  const requests = sql<number>`coalesce(key_stats.r, 0)`;
  const errors = sql<number>`coalesce(key_stats.e, 0)`;
  const promptTokens = sql<number>`coalesce(key_stats.p, 0)`;
  const completionTokens = sql<number>`coalesce(key_stats.c, 0)`;
  const credits = sql<number>`coalesce(key_stats.cr, 0)`;
  // Highest first, ties by id, the same order the in-memory sort used. Keys never used sort last.
  const orderBy: Record<Sort, SQL> = {
    requests: desc(requests),
    tokens: desc(sql`${promptTokens} + ${completionTokens}`),
    credits: desc(credits),
    errors: desc(errors),
    last_used: sql`${s.apiKeys.lastUsedAt} desc nulls last`,
    created: desc(s.apiKeys.createdAt),
  };

  const loadKeys = () =>
    loadPage(
      pageNo,
      (offset, limit) =>
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
            requests: sql<number>`${requests}::int`,
            errors: sql<number>`${errors}::int`,
            promptTokens: sql<number>`${promptTokens}::float8`,
            completionTokens: sql<number>`${completionTokens}::float8`,
            credits: sql<number>`${credits}::float8`,
          })
          .from(s.apiKeys)
          .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId))
          .leftJoin(stats, sql`key_stats.k = ${s.apiKeys.id}`)
          .where(where)
          .orderBy(orderBy[sort], asc(s.apiKeys.id))
          .limit(limit)
          .offset(offset),
      () =>
        cappedCount(
          db
            .select({ id: s.apiKeys.id })
            .from(s.apiKeys)
            .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId))
            .where(where)
            .$dynamic(),
        ),
    );

  const [page, summary] = await Promise.all([
    // Cached per period, status, sort, page and search term. An uncached read touches only
    // api_keys and users; the stats come from the cached JSON above.
    memo(`admin:apikeys:page:${period.key}:${status}:${sort}:${pageNo}:${q}`, LIVE_TTL_MS, loadKeys),
    memo('admin:apikeys:summary', LIVE_TTL_MS, async () => {
      const [r] = await db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${s.apiKeys.status} = 'active')::int`,
        })
        .from(s.apiKeys)
        .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId));
      return r ?? { total: 0, active: 0 };
    }),
  ]);
  const rows = page.items;

  const href = (patch: Partial<Params>) => {
    const n = { period: period.key, q, sort, status, page: String(pageNo), ...patch };
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

      <Pager {...page} en={en} href={(p) => href({ page: String(p) })} />
    </div>
  );
}
