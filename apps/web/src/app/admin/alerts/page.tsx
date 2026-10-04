import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { ALERTS, loadAlerts } from '@/lib/admin-insights';
import { reconcileUserBalance, releaseStuckReservations } from '@/lib/admin-actions';
import { formatCredits, formatTokenEstimate, timeAgo } from '@/lib/utils';
import { AutoRefresh } from '@/components/AutoRefresh';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { UserCell } from '../user-cell';

export const dynamic = 'force-dynamic';

function Card({ title, hint, count, action, children }: { title: string; hint: string; count: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200/90 bg-white shadow-xs">
      <div className="flex flex-col gap-2 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
            {count > 0 ? (
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            )}
            {title}
            <span
              className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${count > 0 ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-500'}`}
            >
              {count}
            </span>
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-6 text-center text-xs text-neutral-500">{text}</p>;
}

export default async function AdminAlerts() {
  await requireAdmin();
  const { locale } = await getServerTranslation();
  const en = locale === 'en';
  const a = await loadAlerts();

  const th = 'py-2.5 px-3 font-mono font-semibold uppercase tracking-wider text-[10px] text-neutral-500';
  const num = 'py-2.5 px-3 text-right font-mono tabular-nums';
  const none = en ? 'Nothing right now.' : 'Aman, tidak ada.';
  const keyCell = (k: { keyId: string; keyName: string; keyPrefix: string }) => (
    <Link href={`/admin/api-keys/${k.keyId}?period=24h`} className="block min-w-0 hover:underline underline-offset-4">
      <div className="truncate font-semibold text-neutral-950">{k.keyName}</div>
      <div className="font-mono text-[11px] text-neutral-500">{k.keyPrefix}…</div>
    </Link>
  );
  const total = a.spikes.length + a.errorKeys.length + a.burners.length + a.sharedIps.length + a.mismatches.length + a.stuckTotal.n;

  return (
    <div className="max-w-6xl space-y-6">
      <AutoRefresh intervalMs={30_000} />
      <div className="border-b border-neutral-200/80 pb-5">
        <h1 className="flex items-center gap-2 font-heading text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl">
          <AlertTriangle className="h-5 w-5 text-neutral-700" />
          {en ? 'Alerts' : 'Alert'}
          {total > 0 && <span className="rounded-lg bg-red-600 px-2 py-0.5 text-sm text-white">{total}</span>}
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
          {en
            ? 'Unusual usage and billing problems, recomputed every 30 seconds.'
            : 'Pemakaian tidak wajar dan masalah billing, dihitung ulang tiap 30 detik.'}
        </p>
      </div>

      <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500">{en ? 'Billing' : 'Billing'}</h2>

      <Card
        title={en ? 'Balance does not match ledger' : 'Saldo tidak cocok dengan ledger'}
        hint={
          en
            ? 'The cached balance should equal the sum of the credit ledger. Fix rebuilds the balance from the ledger.'
            : 'Saldo tersimpan harus sama dengan total credit ledger. Perbaiki = hitung ulang saldo dari ledger.'
        }
        count={a.mismatches.length}
      >
        {a.mismatches.length === 0 ? (
          <Empty text={none} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
                <tr>
                  <th className={`${th} text-left`}>User</th>
                  <th className={`${th} text-right`}>{en ? 'Balance' : 'Saldo'}</th>
                  <th className={`${th} text-right`}>Ledger</th>
                  <th className={`${th} text-right`}>{en ? 'Difference' : 'Selisih'}</th>
                  <th className={`${th} text-right`} />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {a.mismatches.map((m) => (
                  <tr key={m.userId}>
                    <td className="py-2.5 px-3"><UserCell name={m.name} email={m.email} image={m.image} role={m.role} /></td>
                    <td className={`${num} text-neutral-800`}>{formatCredits(m.cached)}</td>
                    <td className={`${num} text-neutral-800`}>{formatCredits(m.ledger)}</td>
                    <td className={`${num} font-bold text-red-600`}>
                      {m.cached - m.ledger > 0 ? '+' : ''}
                      {formatCredits(m.cached - m.ledger)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <form action={reconcileUserBalance}>
                        <input type="hidden" name="userId" value={m.userId} />
                        <button type="submit" className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-100">
                          {en ? 'Fix' : 'Perbaiki'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={en ? 'Stuck reservations' : 'Reservation nyangkut'}
        hint={
          en
            ? `Credits held for requests that never settled and are past expiry. ${formatCredits(a.stuckTotal.credits)} credits held in total.`
            : `Kredit yang di-hold untuk request yang tidak selesai dan sudah lewat batas. Total ${formatCredits(a.stuckTotal.credits)} kredit tertahan.`
        }
        count={a.stuckTotal.n}
        action={
          a.stuckTotal.n > 0 && (
            <form action={releaseStuckReservations}>
              <button type="submit" className="rounded-xl bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800">
                {en ? 'Release all' : 'Lepas semua'}
              </button>
            </form>
          )
        }
      >
        {a.stuck.length === 0 ? (
          <Empty text={none} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
                <tr>
                  <th className={`${th} text-left`}>User</th>
                  <th className={`${th} text-right`}>{en ? 'Held' : 'Di-hold'}</th>
                  <th className={`${th} text-left`}>{en ? 'Source' : 'Sumber'}</th>
                  <th className={`${th} text-right`}>{en ? 'Created' : 'Dibuat'}</th>
                  <th className={`${th} text-right`}>{en ? 'Expired' : 'Kedaluwarsa'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {a.stuck.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3"><UserCell name={r.name} email={r.email} image={r.image} role={r.role} /></td>
                    <td className={`${num} font-semibold text-neutral-950`}>{formatCredits(r.credits)}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">{r.sourceType}</td>
                    <td className={`${num} text-neutral-600`}>{timeAgo(r.createdAt, locale)}</td>
                    <td className={`${num} text-red-600`}>{timeAgo(r.expiresAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2 className="pt-2 text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500">{en ? 'Usage' : 'Pemakaian'}</h2>

      <Card
        title={en ? 'Traffic spike per key' : 'Lonjakan request per key'}
        hint={
          en
            ? `Last hour at least ${ALERTS.spikeRatio}x the key's hourly average over the previous 7 days, and at least ${ALERTS.spikeMinRequests} requests.`
            : `1 jam terakhir minimal ${ALERTS.spikeRatio}x rata-rata per jam key itu selama 7 hari sebelumnya, dan minimal ${ALERTS.spikeMinRequests} request.`
        }
        count={a.spikes.length}
      >
        {a.spikes.length === 0 ? (
          <Empty text={none} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
                <tr>
                  <th className={`${th} text-left`}>Key</th>
                  <th className={`${th} text-left`}>{en ? 'Owner' : 'Pemilik'}</th>
                  <th className={`${th} text-right`}>{en ? 'Last hour' : '1 jam terakhir'}</th>
                  <th className={`${th} text-right`}>{en ? 'Usual / hour' : 'Biasanya / jam'}</th>
                  <th className={`${th} text-right`}>{en ? 'Ratio' : 'Rasio'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {a.spikes.map((k) => (
                  <tr key={k.keyId}>
                    <td className="py-2.5 px-3">{keyCell(k)}</td>
                    <td className="py-2.5 px-3"><UserCell name={k.name} email={k.email} image={k.image} role={k.role} /></td>
                    <td className={`${num} font-bold text-neutral-950`}>{formatCredits(k.lastHour)}</td>
                    <td className={`${num} text-neutral-600`}>{Number(k.perHour).toFixed(1)}</td>
                    <td className={`${num} font-bold text-red-600`}>{Number(k.perHour) > 0 ? `${(k.lastHour / Number(k.perHour)).toFixed(0)}x` : en ? 'new' : 'baru'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={en ? 'High failure rate per key' : 'Error rate tinggi per key'}
        hint={
          en
            ? `Last hour: at least ${ALERTS.errorMinRequests} requests and ${ALERTS.errorRate * 100}% or more failed.`
            : `1 jam terakhir: minimal ${ALERTS.errorMinRequests} request dan ${ALERTS.errorRate * 100}% atau lebih gagal.`
        }
        count={a.errorKeys.length}
      >
        {a.errorKeys.length === 0 ? (
          <Empty text={none} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
                <tr>
                  <th className={`${th} text-left`}>Key</th>
                  <th className={`${th} text-left`}>{en ? 'Owner' : 'Pemilik'}</th>
                  <th className={`${th} text-right`}>{en ? 'Failed / total' : 'Gagal / total'}</th>
                  <th className={`${th} text-left`}>{en ? 'Most common error' : 'Error terbanyak'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {a.errorKeys.map((k) => (
                  <tr key={k.keyId}>
                    <td className="py-2.5 px-3">{keyCell(k)}</td>
                    <td className="py-2.5 px-3"><UserCell name={k.name} email={k.email} image={k.image} role={k.role} /></td>
                    <td className={`${num} font-bold text-red-600`}>
                      {formatCredits(k.errors)} / {formatCredits(k.requests)}
                      <div className="text-[11px] font-semibold">{((k.errors / k.requests) * 100).toFixed(0)}%</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-700 break-all">{k.topError ?? 'unknown'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={en ? 'Credit burn spike per user' : 'Pemakaian kredit melonjak per user'}
        hint={
          en
            ? `Last 24h at least ${ALERTS.burnRatio}x the user's daily average over the previous 7 days, with ${ALERTS.burnMinRequests}+ requests.`
            : `24 jam terakhir minimal ${ALERTS.burnRatio}x rata-rata harian user itu selama 7 hari sebelumnya, dengan ${ALERTS.burnMinRequests}+ request.`
        }
        count={a.burners.length}
      >
        {a.burners.length === 0 ? (
          <Empty text={none} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50/60">
                <tr>
                  <th className={`${th} text-left`}>User</th>
                  <th className={`${th} text-right`}>{en ? 'Credits 24h' : 'Kredit 24 jam'}</th>
                  <th className={`${th} text-right`}>{en ? 'Usual / day' : 'Biasanya / hari'}</th>
                  <th className={`${th} text-right`}>Req 24h</th>
                  <th className={`${th} text-right`}>{en ? 'Balance now' : 'Saldo sekarang'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {a.burners.map((u) => (
                  <tr key={u.userId}>
                    <td className="py-2.5 px-3"><UserCell name={u.name} email={u.email} image={u.image} role={u.role} /></td>
                    <td className={`${num} font-bold text-red-600`}>{formatTokenEstimate(u.last24h)}</td>
                    <td className={`${num} text-neutral-600`}>{formatTokenEstimate(Number(u.perDay))}</td>
                    <td className={`${num} text-neutral-800`}>{formatCredits(u.requests)}</td>
                    <td className={`${num} text-neutral-800`}>{formatTokenEstimate(u.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={en ? 'Many accounts from one IP' : 'Banyak akun dari IP yang sama'}
        hint={
          en
            ? `${ALERTS.sharedIpUsers}+ different accounts logged in from the same IP in the last ${ALERTS.sharedIpDays} days. Could be one office or one person farming free credits.`
            : `${ALERTS.sharedIpUsers}+ akun berbeda login dari IP yang sama dalam ${ALERTS.sharedIpDays} hari terakhir. Bisa satu kantor, bisa juga satu orang farming kredit gratis.`
        }
        count={a.sharedIps.length}
      >
        {a.sharedIps.length === 0 ? (
          <Empty text={none} />
        ) : (
          <ul className="divide-y divide-neutral-100 text-xs">
            {a.sharedIps.map((ip) => (
              <li key={ip.ip} className="space-y-1.5 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-neutral-950">{ip.ip}</span>
                  <span className="text-neutral-500">
                    <span className="font-bold text-red-600">{ip.users}</span> {en ? 'accounts' : 'akun'} · {en ? 'last login' : 'login terakhir'}{' '}
                    {timeAgo(ip.last, locale)}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-neutral-700 break-all">{ip.emails.filter(Boolean).join(', ')}</div>
                <div className="text-[11px] text-neutral-500 break-all">{ip.agents.filter(Boolean).slice(0, 3).join(' | ')}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
