import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { hasAdminPermission } from '@morphic/shared/admin-rbac';
import {
  createAbuseCase,
  syncAbuseCasesFromSignals,
  updateAbuseCaseStatus,
} from '@/lib/admin-actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { timeAgo } from '@/lib/utils';
import { memo } from '@/lib/memo';
import { LIVE_TTL_MS } from '@/lib/refresh';
import { loadPage, readPage } from '@/lib/page-numbers';
import { cappedCount } from '@/lib/capped-count';
import { Pager } from '@/components/Pager';
import { ShieldAlert, RefreshCw, Plus } from 'lucide-react';
import { UserCell } from '../user-cell';

export const dynamic = 'force-dynamic';

const STATUS_OPTS = ['all', 'open', 'investigating', 'resolved', 'dismissed'] as const;

export default async function AdminAbuseQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const admin = await requireAdmin('security:read');
  const canWrite = hasAdminPermission(admin.role, 'security:write');
  const { locale } = await getServerTranslation();
  const en = locale === 'en';
  const params = await searchParams;
  const activeStatus = STATUS_OPTS.includes(params.status as any)
    ? (params.status as (typeof STATUS_OPTS)[number])
    : 'all';
  const whereClause =
    activeStatus !== 'all'
      ? eq(s.abuseCases.status, activeStatus as 'open' | 'investigating' | 'resolved' | 'dismissed')
      : undefined;

  // Counts every status regardless of filter or page, so one key serves every click. They feed the
  // tabs only: they can lag a status change by LIVE_TTL_MS, so the pager counts fresh below.
  const statusCountsP = memo('admin:abuse:status-counts', LIVE_TTL_MS, () => db
    .select({
      status: s.abuseCases.status,
      count: sql<number>`count(*)::int`,
    })
    .from(s.abuseCases)
    .groupBy(s.abuseCases.status));

  const [page, statusCounts] = await Promise.all([
    loadPage(
      readPage(params.page),
      (offset, limit) =>
        db
          .select({
            id: s.abuseCases.id,
            userId: s.abuseCases.userId,
            apiKeyId: s.abuseCases.apiKeyId,
            signalType: s.abuseCases.signalType,
            severity: s.abuseCases.severity,
            status: s.abuseCases.status,
            summary: s.abuseCases.summary,
            metadata: s.abuseCases.metadata,
            resolutionNote: s.abuseCases.resolutionNote,
            createdAt: s.abuseCases.createdAt,
            userName: s.users.name,
            userEmail: s.users.email,
            userImage: s.users.image,
            userRole: s.users.role,
            userSuspended: s.users.suspended,
            keyName: s.apiKeys.name,
            keyPrefix: s.apiKeys.keyPrefix,
            keyStatus: s.apiKeys.status,
          })
          .from(s.abuseCases)
          .leftJoin(s.users, eq(s.users.id, s.abuseCases.userId))
          .leftJoin(s.apiKeys, eq(s.apiKeys.id, s.abuseCases.apiKeyId))
          .where(whereClause)
          .orderBy(desc(s.abuseCases.createdAt), desc(s.abuseCases.id))
          .limit(limit)
          .offset(offset),
      () => cappedCount(db.select({ id: s.abuseCases.id }).from(s.abuseCases).where(whereClause).$dynamic()),
    ),
    statusCountsP,
  ]);
  const rows = page.items;

  const counts: Record<string, number> = {
    open: 0,
    investigating: 0,
    resolved: 0,
    dismissed: 0,
  };
  let totalAll = 0;
  for (const c of statusCounts) {
    counts[c.status] = c.count;
    totalAll += c.count;
  }

  const severityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border border-neutral-200';
    }
  };

  const statusBadge = (st: string) => {
    switch (st) {
      case 'open':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'investigating':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'dismissed':
        return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
      default:
        return 'bg-neutral-100 text-neutral-600';
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 border-b border-neutral-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl">
            <ShieldAlert className="h-5 w-5 text-neutral-800" />
            {en ? 'Abuse Review Queue' : 'Antrean Kasus Abuse'}
            {counts.open + counts.investigating > 0 && (
              <span className="rounded-lg bg-red-600 px-2 py-0.5 text-sm text-white">
                {counts.open + counts.investigating}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">
            {en
              ? 'Zero-prompt metadata review queue (AI-08 / AI-09). Inspect anomaly signals, track investigation status, and execute rapid key revocation or account suspension.'
              : 'Antrean peninjauan penyalahgunaan berbasis metadata tanpa isi prompt (AI-08 / AI-09). Tinjau sinyal anomali, catat investigasi, dan eksekusi pencabutan key atau suspensi akun.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/alerts"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            {en ? 'View Live Signals' : 'Lihat Sinyal Live (/admin/alerts)'}
          </Link>
          {canWrite && (
            <form action={syncAbuseCasesFromSignals}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white hover:bg-neutral-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {en ? 'Sync Anomaly Signals' : 'Tarik Sinyal Anomali Baru'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_OPTS.map((st) => {
            const active = activeStatus === st;
            const count = st === 'all' ? totalAll : (counts[st] ?? 0);
            const label =
              st === 'all'
                ? en
                  ? 'All'
                  : 'Semua'
                : st.charAt(0).toUpperCase() + st.slice(1);
            return (
              <Link
                key={st}
                href={st === 'all' ? '/admin/abuse' : `/admin/abuse?status=${st}`}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-neutral-950 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`rounded-md px-1.5 py-0.2 font-mono text-[10px] ${
                    active ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        {canWrite && (
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50">
              <Plus className="h-3.5 w-3.5" />
              {en ? 'New Manual Case' : 'Buat Kasus Manual'}
            </summary>
            <form
              action={createAbuseCase}
              className="mt-2 w-full max-w-xl space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-md sm:w-96"
            >
              <div className="text-xs font-bold text-neutral-950">
                {en ? 'Open Manual Abuse Case' : 'Buka Kasus Abuse Baru'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-medium text-neutral-600">
                  {en ? 'Signal Type' : 'Jenis Sinyal'}
                  <select
                    name="signalType"
                    defaultValue="manual"
                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900"
                  >
                    <option value="manual">manual</option>
                    <option value="traffic_spike">traffic_spike</option>
                    <option value="high_error_rate">high_error_rate</option>
                    <option value="credit_burn_spike">credit_burn_spike</option>
                    <option value="shared_ip_farming">shared_ip_farming</option>
                  </select>
                </label>
                <label className="block text-[11px] font-medium text-neutral-600">
                  {en ? 'Severity' : 'Keparahan'}
                  <select
                    name="severity"
                    defaultValue="medium"
                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900"
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
              </div>
              <label className="block text-[11px] font-medium text-neutral-600">
                User ID (UUID, opsional)
                <input
                  type="text"
                  name="userId"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 font-mono text-xs text-neutral-900"
                />
              </label>
              <label className="block text-[11px] font-medium text-neutral-600">
                API Key ID (UUID, opsional)
                <input
                  type="text"
                  name="apiKeyId"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 font-mono text-xs text-neutral-900"
                />
              </label>
              <label className="block text-[11px] font-medium text-neutral-600">
                {en ? 'Summary (metadata only, no prompt text)' : 'Ringkasan Temuan (hanya metadata)'}
                <textarea
                  name="summary"
                  required
                  rows={2}
                  placeholder={
                    en
                      ? 'Describe the suspicious metadata pattern...'
                      : 'Jelaskan pola anomali metadata yang ditemukan...'
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-900"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-neutral-950 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-800"
              >
                {en ? 'Create Case' : 'Simpan Kasus'}
              </button>
            </form>
          </details>
        )}
      </div>

      {/* Cases list */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/90 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-neutral-800">
            {en ? 'No abuse cases in this queue.' : 'Belum ada kasus abuse pada filter ini.'}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {en
              ? 'Click "Sync Anomaly Signals" above to import active spikes, error rates, or multi-account IP signals.'
              : 'Klik tombol "Tarik Sinyal Anomali Baru" di kanan atas untuk mengimpor sinyal lonjakan trafik, error rate, atau indikasi multi-akun IP.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const metaObj =
              c.metadata && typeof c.metadata === 'object' && !Array.isArray(c.metadata)
                ? (c.metadata as Record<string, unknown>)
                : null;
            return (
              <article
                key={c.id}
                className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${severityBadge(
                          c.severity,
                        )}`}
                      >
                        {c.severity}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${statusBadge(
                          c.status,
                        )}`}
                      >
                        {c.status}
                      </span>
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[10px] text-neutral-700">
                        {c.signalType}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-400">
                        #{c.id.slice(0, 8)} · {timeAgo(c.createdAt, locale)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-950">{c.summary}</p>
                  </div>

                  {/* Subject User / API Key */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {c.userId && c.userEmail && (
                      <div className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50/70 px-3 py-1.5">
                        <UserCell
                          name={c.userName}
                          email={c.userEmail}
                          image={c.userImage}
                          role={c.userRole}
                        />
                        {c.userSuspended && (
                          <span className="rounded bg-red-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                            SUSPENDED
                          </span>
                        )}
                      </div>
                    )}
                    {c.apiKeyId && (
                      <Link
                        href={`/admin/api-keys/${c.apiKeyId}?period=24h`}
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-800 hover:bg-neutral-50"
                      >
                        Key: <span className="font-semibold">{c.keyName ?? 'API Key'}</span> (
                        {c.keyPrefix ?? 'mp-'}…)
                        {c.keyStatus === 'revoked' && (
                          <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            REVOKED
                          </span>
                        )}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Metadata chips (Zero-Prompt Auditing) */}
                {metaObj && Object.keys(metaObj).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(metaObj).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-lg border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 font-mono text-[11px] text-neutral-700"
                      >
                        <span className="text-neutral-500">{k}:</span>{' '}
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    ))}
                  </div>
                )}

                {c.resolutionNote && (
                  <p className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                    <span className="font-semibold text-neutral-900">
                      {en ? 'Investigation Note:' : 'Catatan Investigasi:'}
                    </span>{' '}
                    {c.resolutionNote}
                  </p>
                )}

                {canWrite && (
                  <form
                    action={updateAbuseCaseStatus}
                    className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-3 sm:flex-row sm:items-center"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <select
                      name="status"
                      defaultValue={c.status}
                      aria-label="Status kasus abuse"
                      className="rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-900"
                    >
                      <option value="open">Status: Open</option>
                      <option value="investigating">Status: Investigating</option>
                      <option value="resolved">Status: Resolved</option>
                      <option value="dismissed">Status: Dismissed (False Positive)</option>
                    </select>

                    <select
                      name="quickAction"
                      defaultValue="none"
                      aria-label="Tindakan cepat"
                      className="rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800"
                    >
                      <option value="none">
                        {en ? 'Action: Status/Note only' : 'Tindakan: Hanya ubah status/catatan'}
                      </option>
                      {c.apiKeyId && c.keyStatus !== 'revoked' && (
                        <option value="revoke_key">
                          {en ? 'Action: Revoke API Key' : 'Tindakan Cepat: Cabut API Key (Revoke)'}
                        </option>
                      )}
                      {c.userId && !c.userSuspended && (
                        <option value="suspend_user">
                          {en
                            ? 'Action: Suspend User & Clear Sessions'
                            : 'Tindakan Cepat: Suspend User & Cabut Sesi'}
                        </option>
                      )}
                    </select>

                    <input
                      type="text"
                      name="resolutionNote"
                      defaultValue={c.resolutionNote ?? ''}
                      placeholder={
                        en
                          ? 'Add investigation / resolution note...'
                          : 'Tambahkan catatan investigasi / tindakan...'
                      }
                      className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-900"
                    />

                    <button
                      type="submit"
                      className="rounded-xl bg-neutral-950 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
                    >
                      {en ? 'Update' : 'Simpan'}
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
      <Pager
        {...page}
        en={en}
        href={(p) => {
          const q = new URLSearchParams();
          if (activeStatus !== 'all') q.set('status', activeStatus);
          if (p > 1) q.set('page', String(p));
          const qs = q.toString();
          return qs ? `/admin/abuse?${qs}` : '/admin/abuse';
        }}
      />
    </div>
  );
}
