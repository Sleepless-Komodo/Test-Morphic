import Link from 'next/link';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { Download, History } from 'lucide-react';
import { listAuditActions, queryAuditLog, readAuditFilters } from './query';

const PAGE_LIMIT = 200;
const fieldClass =
  'min-h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-950';

export default async function AdminAudit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { t } = await getServerTranslation();
  const filters = readAuditFilters(await searchParams);
  const filtered = Boolean(filters.q || filters.action || filters.from || filters.to);
  const [entries, actions] = await Promise.all([queryAuditLog(filters, PAGE_LIMIT), listAuditActions()]);
  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter((kv): kv is [string, string] => Boolean(kv[1])),
  ).toString();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-5 border-b border-neutral-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-neutral-950 flex items-center gap-2">
            <History className="w-5 h-5 text-neutral-700" />
            {t.admin.audit.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            {t.admin.audit.desc} ({entries.length} {t.admin.audit.recentLogs}).
          </p>
        </div>
        <a
          href={`/admin/audit/export${exportQuery ? `?${exportQuery}` : ''}`}
          className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
        >
          <Download className="h-3.5 w-3.5" />
          {t.admin.audit.exportCsv}
        </a>
      </div>

      <form method="get" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_1fr_auto] gap-3 items-end">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-neutral-700">{t.admin.audit.filterSearch}</span>
          <input type="search" name="q" defaultValue={filters.q} className={fieldClass} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-neutral-700">{t.admin.audit.filterAction}</span>
          <select name="action" defaultValue={filters.action ?? ''} className={fieldClass}>
            <option value="">{t.admin.audit.allActions}</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-neutral-700">{t.admin.audit.filterFrom}</span>
          <input type="date" name="from" defaultValue={filters.from} className={fieldClass} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold text-neutral-700">{t.admin.audit.filterTo}</span>
          <input type="date" name="to" defaultValue={filters.to} className={fieldClass} />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="min-h-10 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
          >
            {t.admin.audit.applyFilters}
          </button>
          {filtered && (
            <Link
              href="/admin/audit"
              className="min-h-10 px-3 inline-flex items-center rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              {t.admin.audit.resetFilters}
            </Link>
          )}
        </div>
      </form>

      {entries.length === PAGE_LIMIT && <p className="text-[11px] text-neutral-600">{t.admin.audit.showingCap}</p>}

      {/* Audit Table Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-600">
            {filtered ? t.admin.audit.noMatch : t.admin.audit.noAudit}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/50">
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-4">{t.admin.audit.thWhen}</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">{t.admin.audit.thAdmin}</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">{t.admin.audit.thAction}</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-3">{t.admin.audit.thEntity}</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-3 px-4">{t.admin.audit.thDetail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                      {e.createdAt.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-neutral-950">{e.adminEmail ?? '—'}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-800 border border-neutral-200">
                        {e.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-neutral-700">
                      {e.entity}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ''}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 max-w-sm truncate">
                      {e.detail ? JSON.stringify(e.detail) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

