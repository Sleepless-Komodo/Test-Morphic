import Link from 'next/link';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { formatCredits, formatTokenEstimate } from '@/lib/utils';

// Same conversion the checkout uses for USD packages, so the ranking compares like with like.
const IDR_PER_USD = 16_000;

const PERIODS = [
  { key: '7d', days: 7, en: '7 days', id: '7 hari' },
  { key: '30d', days: 30, en: '30 days', id: '30 hari' },
  { key: 'all', days: null, en: 'All time', id: 'Semua' },
] as const;

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- OAuth avatars come from arbitrary hosts
    return <img src={image} alt="" className="h-9 w-9 shrink-0 rounded-full border border-neutral-200 object-cover" loading="lazy" />;
  }
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-950 text-xs font-bold text-white">
      {initials}
    </span>
  );
}

function UserCell({ name, email, image, role }: { name: string | null; email: string | null; image: string | null; role: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name || email || '?'} image={image} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-neutral-950">{name || '—'}</span>
          {role === 'admin' && (
            <span className="rounded-md bg-neutral-950 px-1.5 py-0.5 text-[10px] font-bold text-white">admin</span>
          )}
        </div>
        <div className="truncate text-xs text-neutral-500">{email ?? '—'}</div>
      </div>
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold tabular-nums ${
        n <= 3 ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-500'
      }`}
    >
      {n}
    </span>
  );
}

export default async function AdminLeaderboard({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const { locale } = await getServerTranslation();
  const en = locale === 'en';
  const { period: periodParam } = await searchParams;
  const period = PERIODS.find((p) => p.key === periodParam) ?? PERIODS[1];
  const since = period.days ? new Date(Date.now() - period.days * 86_400_000) : null;

  const spendIdr = sql<number>`coalesce(sum(case when ${s.payments.currency} = 'USD' then ${s.payments.amountCents}::numeric / 100 * ${IDR_PER_USD} else ${s.payments.amountCents} end), 0)::float8`;
  const paidWhere = since
    ? and(eq(s.payments.status, 'paid'), gt(s.payments.paidAt, since))
    : eq(s.payments.status, 'paid');
  const reqWhere = since ? gt(s.requestLogs.createdAt, since) : undefined;
  const requests = sql<number>`count(*)::int`;

  // All four reads run in parallel: one round trip of latency for the whole page.
  const [spenders, requesters, [revenue], [traffic]] = await Promise.all([
    db
      .select({
        userId: s.users.id,
        name: s.users.name,
        email: s.users.email,
        image: s.users.image,
        role: s.users.role,
        spendIdr,
        idr: sql<number>`coalesce(sum(${s.payments.amountCents}) filter (where ${s.payments.currency} <> 'USD'), 0)::float8`,
        usdCents: sql<number>`coalesce(sum(${s.payments.amountCents}) filter (where ${s.payments.currency} = 'USD'), 0)::float8`,
        credits: sql<number>`coalesce(sum(${s.payments.credits}), 0)::float8`,
        orders: sql<number>`count(*)::int`,
      })
      .from(s.payments)
      .innerJoin(s.users, eq(s.users.id, s.payments.userId))
      .where(paidWhere)
      .groupBy(s.users.id)
      .orderBy(desc(spendIdr))
      .limit(10),
    db
      .select({
        userId: s.users.id,
        name: s.users.name,
        email: s.users.email,
        image: s.users.image,
        role: s.users.role,
        requests,
        errors: sql<number>`count(*) filter (where ${s.requestLogs.status} <> 'success')::int`,
        tokens: sql<number>`coalesce(sum(coalesce(${s.requestLogs.promptTokens}, 0) + coalesce(${s.requestLogs.completionTokens}, 0)), 0)::float8`,
        credits: sql<number>`coalesce(sum(${s.requestLogs.creditsConsumed}), 0)::float8`,
      })
      .from(s.requestLogs)
      .innerJoin(s.users, eq(s.users.id, s.requestLogs.userId))
      .where(reqWhere)
      .groupBy(s.users.id)
      .orderBy(desc(requests))
      .limit(10),
    db.select({ total: spendIdr, buyers: sql<number>`count(distinct ${s.payments.userId})::int` }).from(s.payments).where(paidWhere),
    db
      .select({ total: requests, users: sql<number>`count(distinct ${s.requestLogs.userId})::int` })
      .from(s.requestLogs)
      .where(reqWhere),
  ]);

  const tile = 'rounded-3xl border border-neutral-200/90 bg-white shadow-2xs';
  const label = 'text-xs font-semibold text-neutral-500';

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl">Leaderboard</h1>
          <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
            {en ? 'Who spends the most and who sends the most requests.' : 'Siapa yang paling banyak top up dan paling banyak kirim request.'}
          </p>
        </div>
        <nav aria-label={en ? 'Period' : 'Periode'} className="inline-flex rounded-xl border border-neutral-200 bg-white p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/admin/leaderboard?period=${p.key}`}
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
        <div className={`${tile} p-5`}>
          <div className={label}>{en ? 'Revenue' : 'Pendapatan'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{rupiah(revenue?.total ?? 0)}</div>
        </div>
        <div className={`${tile} p-5`}>
          <div className={label}>{en ? 'Paying users' : 'User yang bayar'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{revenue?.buyers ?? 0}</div>
        </div>
        <div className={`${tile} p-5`}>
          <div className={label}>{en ? 'Requests' : 'Request'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{formatCredits(traffic?.total ?? 0)}</div>
        </div>
        <div className={`${tile} p-5`}>
          <div className={label}>{en ? 'Active API users' : 'User aktif API'}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-950">{traffic?.users ?? 0}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={tile}>
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-bold text-neutral-950">{en ? 'Top spenders' : 'Top spending'}</h2>
            <p className="text-[11px] text-neutral-500">
              {en ? `Paid top-ups. USD counted at Rp ${IDR_PER_USD.toLocaleString('id-ID')}/$.` : `Top up yang lunas. USD dihitung Rp ${IDR_PER_USD.toLocaleString('id-ID')}/$.`}
            </p>
          </div>
          {spenders.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">{en ? 'No paid top-ups in this period.' : 'Belum ada top up lunas di periode ini.'}</p>
          ) : (
            <ol className="divide-y divide-neutral-100">
              {spenders.map((r, i) => (
                <li key={r.userId} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-50">
                  <Rank n={i + 1} />
                  <div className="min-w-0 flex-1">
                    <UserCell name={r.name} email={r.email} image={r.image} role={r.role} />
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums text-neutral-950">{rupiah(r.spendIdr)}</div>
                    <div className="text-[11px] tabular-nums text-neutral-500">
                      {r.orders}× · {formatTokenEstimate(r.credits)} {en ? 'credits' : 'kredit'}
                      {r.usdCents > 0 ? ` · $${(r.usdCents / 100).toFixed(2)}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={tile}>
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-bold text-neutral-950">{en ? 'Top requests' : 'Top request'}</h2>
            <p className="text-[11px] text-neutral-500">{en ? 'Gateway requests, including failed ones.' : 'Request ke gateway, termasuk yang gagal.'}</p>
          </div>
          {requesters.length === 0 ? (
            <p className="p-8 text-center text-sm text-neutral-500">{en ? 'No requests in this period.' : 'Belum ada request di periode ini.'}</p>
          ) : (
            <ol className="divide-y divide-neutral-100">
              {requesters.map((r, i) => (
                <li key={r.userId} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-50">
                  <Rank n={i + 1} />
                  <div className="min-w-0 flex-1">
                    <UserCell name={r.name} email={r.email} image={r.image} role={r.role} />
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold tabular-nums text-neutral-950">
                      {formatCredits(r.requests)} req
                    </div>
                    <div className="text-[11px] tabular-nums text-neutral-500">
                      {formatTokenEstimate(r.tokens)} token · {formatTokenEstimate(r.credits)} {en ? 'credits' : 'kredit'}
                      {r.errors > 0 ? ` · ${r.errors} ${en ? 'failed' : 'gagal'}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
