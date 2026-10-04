import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, gt, ne, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { formatCredits, formatTokenEstimate, timeAgo } from '@/lib/utils';
import { AutoRefresh } from '@/components/AutoRefresh';
import { memo } from '@/lib/memo';
import { ArrowLeft } from 'lucide-react';
import { UserCell } from '../../user-cell';
import { PERIODS, parsePeriod, keyStatus } from '../period';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Daily buckets follow the business's clock, not UTC.
const TZ = 'Asia/Jakarta';

export default async function AdminApiKeyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const { locale } = await getServerTranslation();
  const en = locale === 'en';
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { period, since } = parsePeriod((await searchParams).period);

  const [key] = await db
    .select({
      id: s.apiKeys.id,
      name: s.apiKeys.name,
      keyPrefix: s.apiKeys.keyPrefix,
      status: s.apiKeys.status,
      expiresAt: s.apiKeys.expiresAt,
      lastUsedAt: s.apiKeys.lastUsedAt,
      createdAt: s.apiKeys.createdAt,
      revokedAt: s.apiKeys.revokedAt,
      userId: s.users.id,
      userName: s.users.name,
      userEmail: s.users.email,
      userImage: s.users.image,
      userRole: s.users.role,
    })
    .from(s.apiKeys)
    .innerJoin(s.users, eq(s.users.id, s.apiKeys.userId))
    .where(eq(s.apiKeys.id, id))
    .limit(1);
  if (!key) notFound();

  const L = s.requestLogs;
  const where = and(eq(L.apiKeyId, id), since ? gt(L.createdAt, since) : undefined);
  const requests = sql<number>`count(*)::int`;
  const errors = sql<number>`count(*) filter (where ${L.status} <> 'success')::int`;
  const prompt = sql<number>`coalesce(sum(${L.promptTokens}), 0)::float8`;
  const completion = sql<number>`coalesce(sum(${L.completionTokens}), 0)::float8`;
  const credits = sql<number>`coalesce(sum(${L.creditsConsumed}), 0)::float8`;
  const avgLatency = sql<number | null>`round(avg(${L.latencyMs}))::int`;
  // TZ inlined as a literal: a bound param gets a new $n per use, and Postgres then
  // rejects GROUP BY because the select and group expressions no longer match.
  const day = sql<string>`to_char(date_trunc('day', ${L.createdAt} at time zone ${sql.raw(`'${TZ}'`)}), 'YYYY-MM-DD')`;

  const [[totals], byModel, byDay, byError, recent] = await memo(`admin:apikey:${id}:${period.key}`, 20_000, () => Promise.all([
    db
      .select({
        requests,
        errors,
        prompt,
        completion,
        credits,
        avgLatency,
        p95Latency: sql<number | null>`percentile_cont(0.95) within group (order by ${L.latencyMs})::int`,
        streamed: sql<number>`count(*) filter (where ${L.streamed})::int`,
        first: sql<string | null>`min(${L.createdAt})`,
        last: sql<string | null>`max(${L.createdAt})`,
      })
      .from(L)
      .where(where),
    db
      .select({ model: L.modelAlias, provider: L.providerName, requests, errors, prompt, completion, credits, avgLatency })
      .from(L)
      .where(where)
      .groupBy(L.modelAlias, L.providerName)
      .orderBy(desc(requests)),
    db
      .select({ day, requests, errors, tokens: sql<number>`coalesce(sum(coalesce(${L.promptTokens}, 0) + coalesce(${L.completionTokens}, 0)), 0)::float8`, credits })
      .from(L)
      .where(where)
      .groupBy(day)
      .orderBy(desc(day))
      .limit(60),
    db
      .select({ type: L.errorType, n: requests })
      .from(L)
      .where(and(where, sql`${L.status} <> 'success'`))
      .groupBy(L.errorType)
      .orderBy(desc(requests)),
    db
      .select({
        id: L.id,
        requestId: L.requestId,
        createdAt: L.createdAt,
        model: L.modelAlias,
        provider: L.providerName,
        status: L.status,
        errorType: L.errorType,
        promptTokens: L.promptTokens,
        completionTokens: L.completionTokens,
        credits: L.creditsConsumed,
        latencyMs: L.latencyMs,
        streamed: L.streamed,
      })
      .from(L)
      .where(where)
      .orderBy(desc(L.createdAt))
      .limit(100),
  ]));

  // Owner's other keys, so you can see whether usage is spread across keys.
  const otherKeys = await memo(`admin:apikey-others:${key.userId}:${id}`, 60_000, () => db
    .select({ id: s.apiKeys.id, name: s.apiKeys.name, keyPrefix: s.apiKeys.keyPrefix, status: s.apiKeys.status, expiresAt: s.apiKeys.expiresAt })
    .from(s.apiKeys)
    .where(and(eq(s.apiKeys.userId, key.userId), ne(s.apiKeys.id, id)))
    .orderBy(desc(s.apiKeys.createdAt)));

  const st = keyStatus(key);
  const t = totals!;
  const successRate = t.requests > 0 ? ((t.requests - t.errors) / t.requests) * 100 : null;
  const dt = (d: Date | string) =>
    new Date(d).toLocaleString(en ? 'en-GB' : 'id-ID', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'medium' });

  const card = 'rounded-2xl border border-neutral-200/90 bg-white shadow-xs';
  const tile = 'rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-2xs';
  const label = 'text-[11px] font-semibold text-neutral-500';
  const big = 'mt-1 text-xl font-extrabold tabular-nums text-neutral-950';
  const th = 'py-2.5 px-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-neutral-500';
  const num = 'py-2 px-3 text-right font-mono tabular-nums';

  return (
    <div className="max-w-6xl space-y-6">
      <AutoRefresh />
      <Link href={`/admin/api-keys?period=${period.key}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-950">
        <ArrowLeft className="h-3.5 w-3.5" />
        {en ? 'All API keys' : 'Semua API key'}
      </Link>

      <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3 min-w-0">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 font-heading text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl">
              <span className="break-all">{key.name}</span>
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  st === 'active' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                }`}
              >
                {st}
              </span>
            </h1>
            <p className="mt-1 font-mono text-xs text-neutral-500">
              {key.keyPrefix}… · {en ? 'created' : 'dibuat'} {dt(key.createdAt)}
              {key.lastUsedAt && ` · ${en ? 'last used' : 'terakhir dipakai'} ${timeAgo(key.lastUsedAt, locale)}`}
              {key.revokedAt && ` · ${en ? 'revoked' : 'dicabut'} ${dt(key.revokedAt)}`}
              {key.expiresAt && ` · ${en ? 'expires' : 'kedaluwarsa'} ${dt(key.expiresAt)}`}
            </p>
          </div>
          <UserCell name={key.userName} email={key.userEmail} image={key.userImage} role={key.userRole} />
        </div>
        <nav aria-label={en ? 'Period' : 'Periode'} className="inline-flex self-start rounded-xl border border-neutral-200 bg-white p-1 lg:self-auto">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/admin/api-keys/${id}?period=${p.key}`}
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={tile}>
          <div className={label}>Request</div>
          <div className={big}>{formatCredits(t.requests)}</div>
          <div className="text-[11px] text-neutral-500">{formatCredits(t.streamed)} streaming</div>
        </div>
        <div className={tile}>
          <div className={label}>{en ? 'Success rate' : 'Tingkat sukses'}</div>
          <div className={`${big} ${successRate !== null && successRate < 95 ? 'text-red-600' : ''}`}>
            {successRate === null ? '—' : `${successRate.toFixed(1)}%`}
          </div>
          <div className="text-[11px] text-neutral-500">{formatCredits(t.errors)} {en ? 'failed' : 'gagal'}</div>
        </div>
        <div className={tile}>
          <div className={label}>Token in / out</div>
          <div className={big}>
            {formatTokenEstimate(t.prompt)} / {formatTokenEstimate(t.completion)}
          </div>
          <div className="text-[11px] text-neutral-500">{formatCredits(t.prompt + t.completion)} total</div>
        </div>
        <div className={tile}>
          <div className={label}>{en ? 'Credits used' : 'Kredit terpakai'}</div>
          <div className={big}>{formatTokenEstimate(t.credits)}</div>
          <div className="text-[11px] text-neutral-500">{formatCredits(t.credits)}</div>
        </div>
        <div className={tile}>
          <div className={label}>{en ? 'Latency avg / p95' : 'Latensi rata-rata / p95'}</div>
          <div className={big}>
            {t.avgLatency ?? '—'} / {t.p95Latency ?? '—'} ms
          </div>
        </div>
        <div className={tile}>
          <div className={label}>{en ? 'Models used' : 'Model dipakai'}</div>
          <div className={big}>{byModel.length}</div>
        </div>
        <div className={`${tile} col-span-2`}>
          <div className={label}>{en ? 'First / last request in period' : 'Request pertama / terakhir di periode ini'}</div>
          <div className="mt-1 text-xs font-mono text-neutral-800">
            {t.first ? dt(t.first) : '—'}
            <br />
            {t.last ? dt(t.last) : '—'}
          </div>
        </div>
      </div>

      <section className={card}>
        <h2 className="border-b border-neutral-100 px-5 py-4 text-sm font-bold text-neutral-950">{en ? 'By model' : 'Per model'}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
              <tr>
                <th className={`${th} text-left`}>Model</th>
                <th className={`${th} text-left`}>Provider</th>
                <th className={`${th} text-right`}>Req</th>
                <th className={`${th} text-right`}>{en ? 'Failed' : 'Gagal'}</th>
                <th className={`${th} text-right`}>Token in</th>
                <th className={`${th} text-right`}>Token out</th>
                <th className={`${th} text-right`}>{en ? 'Credits' : 'Kredit'}</th>
                <th className={`${th} text-right`}>{en ? 'Avg latency' : 'Latensi'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {byModel.map((m) => (
                <tr key={`${m.model}:${m.provider}`} className="hover:bg-neutral-50/60">
                  <td className="py-2 px-3 font-mono font-semibold text-neutral-950 break-all">{m.model}</td>
                  <td className="py-2 px-3 text-neutral-600">{m.provider ?? '—'}</td>
                  <td className={`${num} font-semibold text-neutral-950`}>{formatCredits(m.requests)}</td>
                  <td className={`${num} ${m.errors > 0 ? 'text-red-600 font-semibold' : 'text-neutral-400'}`}>{formatCredits(m.errors)}</td>
                  <td className={`${num} text-neutral-700`}>{formatCredits(m.prompt)}</td>
                  <td className={`${num} text-neutral-700`}>{formatCredits(m.completion)}</td>
                  <td className={`${num} text-neutral-700`}>{formatCredits(m.credits)}</td>
                  <td className={`${num} text-neutral-500`}>{m.avgLatency ?? '—'} ms</td>
                </tr>
              ))}
              {byModel.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-500">{en ? 'No requests in this period.' : 'Belum ada request di periode ini.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className={card}>
          <h2 className="border-b border-neutral-100 px-5 py-4 text-sm font-bold text-neutral-950">
            {en ? 'Per day' : 'Per hari'} <span className="font-normal text-neutral-500">(WIB)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
                <tr>
                  <th className={`${th} text-left`}>{en ? 'Date' : 'Tanggal'}</th>
                  <th className={`${th} text-right`}>Req</th>
                  <th className={`${th} text-right`}>{en ? 'Failed' : 'Gagal'}</th>
                  <th className={`${th} text-right`}>Token</th>
                  <th className={`${th} text-right`}>{en ? 'Credits' : 'Kredit'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {byDay.map((d) => (
                  <tr key={d.day}>
                    <td className="py-2 px-3 font-mono text-neutral-800">{d.day}</td>
                    <td className={`${num} font-semibold text-neutral-950`}>{formatCredits(d.requests)}</td>
                    <td className={`${num} ${d.errors > 0 ? 'text-red-600' : 'text-neutral-400'}`}>{formatCredits(d.errors)}</td>
                    <td className={`${num} text-neutral-700`}>{formatTokenEstimate(d.tokens)}</td>
                    <td className={`${num} text-neutral-700`}>{formatTokenEstimate(d.credits)}</td>
                  </tr>
                ))}
                {byDay.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className={card}>
            <h2 className="border-b border-neutral-100 px-5 py-4 text-sm font-bold text-neutral-950">{en ? 'Failures by type' : 'Error per jenis'}</h2>
            <ul className="divide-y divide-neutral-100 text-xs">
              {byError.map((e) => (
                <li key={e.type ?? 'unknown'} className="flex justify-between gap-3 px-5 py-2.5">
                  <span className="font-mono text-neutral-800 break-all">{e.type ?? 'unknown'}</span>
                  <span className="font-mono font-semibold tabular-nums text-red-600">{formatCredits(e.n)}</span>
                </li>
              ))}
              {byError.length === 0 && <li className="px-5 py-6 text-center text-neutral-500">{en ? 'No failures.' : 'Tidak ada error.'}</li>}
            </ul>
          </section>

          <section className={card}>
            <h2 className="border-b border-neutral-100 px-5 py-4 text-sm font-bold text-neutral-950">
              {en ? "Owner's other keys" : 'Key lain milik user ini'}
            </h2>
            <ul className="divide-y divide-neutral-100 text-xs">
              {otherKeys.map((k) => (
                <li key={k.id}>
                  <Link href={`/admin/api-keys/${k.id}?period=${period.key}`} className="flex justify-between gap-3 px-5 py-2.5 hover:bg-neutral-50">
                    <span className="truncate font-semibold text-neutral-900">{k.name}</span>
                    <span className="shrink-0 font-mono text-neutral-500">
                      {k.keyPrefix}… {keyStatus(k) !== 'active' && `(${keyStatus(k)})`}
                    </span>
                  </Link>
                </li>
              ))}
              {otherKeys.length === 0 && <li className="px-5 py-6 text-center text-neutral-500">{en ? 'None.' : 'Tidak ada.'}</li>}
            </ul>
          </section>
        </div>
      </div>

      <section className={card}>
        <h2 className="border-b border-neutral-100 px-5 py-4 text-sm font-bold text-neutral-950">
          {en ? 'Latest 100 requests' : '100 request terakhir'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
              <tr>
                <th className={`${th} text-left`}>{en ? 'Time (WIB)' : 'Waktu (WIB)'}</th>
                <th className={`${th} text-left`}>Model</th>
                <th className={`${th} text-left`}>Status</th>
                <th className={`${th} text-right`}>Token in / out</th>
                <th className={`${th} text-right`}>{en ? 'Credits' : 'Kredit'}</th>
                <th className={`${th} text-right`}>{en ? 'Latency' : 'Latensi'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50/60">
                  <td className="py-2 px-3 font-mono text-neutral-700 whitespace-nowrap" title={r.requestId}>
                    {dt(r.createdAt)}
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-mono text-neutral-950 break-all">{r.model}</div>
                    <div className="text-[11px] text-neutral-500">
                      {r.provider ?? '—'}
                      {r.streamed && ' · stream'}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`font-mono text-[11px] font-semibold ${r.status === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {r.status}
                    </span>
                    {r.errorType && <div className="font-mono text-[11px] text-neutral-500 break-all">{r.errorType}</div>}
                  </td>
                  <td className={`${num} text-neutral-700`}>
                    {formatCredits(r.promptTokens ?? 0)} / {formatCredits(r.completionTokens ?? 0)}
                  </td>
                  <td className={`${num} text-neutral-700`}>{formatCredits(r.credits ?? 0)}</td>
                  <td className={`${num} text-neutral-500`}>{r.latencyMs ?? '—'} ms</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">{en ? 'No requests in this period.' : 'Belum ada request di periode ini.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
