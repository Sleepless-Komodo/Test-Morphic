'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits, timeAgo } from '@/lib/utils';
import {
  BarChart3,
  Activity,
  Zap,
  Cpu,
  Clock,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { fetchAccountUsage } from '@/lib/actions';

interface RecentRecord {
  id: string;
  requestId?: string | null;
  model: string | null;
  publicModelId?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  credits: number;
  status: string;
  streamed?: boolean | null;
  latencyMs?: number | null;
  createdAt: Date;
}

interface UsageViewProps {
  today: { credits: number };
  month: { credits: number };
  total: { requests: number };
  topModels: Array<{ model: string; credits: number; requests: number }>;
  recent: RecentRecord[];
  totalCount?: number;
}

function CopyTraceId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Tersalin' : `Salin Trace ID: ${id}`}
      className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-500 hover:text-neutral-950 transition-colors cursor-pointer group"
    >
      <span className="truncate max-w-[90px]">{id.length > 14 ? `${id.slice(0, 12)}…` : id}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600 shrink-0" />
      ) : (
        <Copy className="h-3 w-3 text-neutral-400 group-hover:text-neutral-700 shrink-0" />
      )}
    </button>
  );
}

export function UsageView({ today, month, total, topModels, recent, totalCount }: UsageViewProps) {
  const { t, locale } = useTranslation();
  const isId = locale === 'id';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<RecentRecord[]>(recent);
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  const totalPages = Math.max(1, Math.ceil((totalCount || total.requests || 1) / 20));

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || isLoadingPage) return;
    setIsLoadingPage(true);
    try {
      const res = await fetchAccountUsage(newPage, 20);
      if (res.data && res.data.length > 0) {
        setRecords(
          res.data.map((r) => ({
            id: r.id,
            requestId: r.request_id,
            model: r.model,
            publicModelId: r.model,
            promptTokens: r.prompt_tokens,
            completionTokens: r.completion_tokens,
            totalTokens: r.total_tokens,
            credits: r.credits_consumed,
            status: r.status,
            streamed: r.streamed,
            latencyMs: r.latency_ms,
            createdAt: new Date(r.created_at),
          }))
        );
        setPage(newPage);
      }
    } catch (err) {
      console.warn('Failed to fetch usage page:', err);
    } finally {
      setIsLoadingPage(false);
    }
  };

  const filteredRecent = records.filter((r) => {
    const matchesSearch =
      searchTerm === '' ||
      (r.model && r.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.publicModelId && r.publicModelId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.requestId && r.requestId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'success' && r.status === 'success') ||
      (statusFilter === 'error' && r.status !== 'success');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200/70 pb-4">
        <h1 suppressHydrationWarning className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
          {t.dashboard.usagePageTitle}
        </h1>
        <p suppressHydrationWarning className="text-xs md:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
          {t.dashboard.usagePageSubtitle}
        </p>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">
              {t.dashboard.usageToday}
            </span>
            <Zap className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-3xl font-heading font-black text-neutral-950 font-mono tabular-nums">
              {formatCredits(today?.credits ?? 0)}
            </div>
            <div className="text-xs text-neutral-500 mt-1 font-mono">{t.dashboard.usageCreditsUnit}</div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500">
              {t.dashboard.usageThisMonth}
            </span>
            <Activity className="h-4 w-4 text-neutral-900" />
          </div>
          <div>
            <div className="text-3xl font-heading font-black text-neutral-950 font-mono tabular-nums">
              {formatCredits(month?.credits ?? 0)}
            </div>
            <div className="text-xs text-neutral-500 mt-1 font-mono">{t.dashboard.usageCreditsUnit}</div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-neutral-950 text-white border border-neutral-800 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
              {t.dashboard.usageTotalRequests}
            </span>
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-3xl font-heading font-black text-white font-mono tabular-nums">
              {formatCredits(total?.requests ?? 0)}
            </div>
            <div className="text-xs text-neutral-400 mt-1 font-mono">{t.dashboard.usageAllTimeUnit}</div>
          </div>
        </div>
      </div>

      {/* Top Models Breakdown */}
      {topModels.length > 0 && (
        <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-neutral-950" />
            <h2 className="font-heading font-bold text-base text-neutral-950">
              {t.dashboard.usageByModelTitle}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-[11px] font-mono uppercase text-neutral-500">
                  <th className="py-2.5">{t.dashboard.thUsageModel}</th>
                  <th className="py-2.5 text-right">{t.dashboard.thUsageCredits}</th>
                  <th className="py-2.5 text-right">{t.dashboard.thUsageRequests}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono tabular-nums">
                {topModels.map((m, i) => (
                  <tr key={i} className="hover:bg-neutral-50/50">
                    <td className="py-3 font-bold text-neutral-900 font-sans">{m.model ?? (locale === 'en' ? 'Unknown' : 'Tidak Diketahui')}</td>
                    <td className="py-3 text-right text-neutral-700">{formatCredits(m.credits)}</td>
                    <td className="py-3 text-right text-neutral-500">{m.requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity Table with Filter & Observability Columns */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-950" />
            <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">
              {t.dashboard.usageRecentTitle}
            </h2>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isId ? 'Filter model / Trace ID...' : 'Filter model / Trace ID...'}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-950 w-44 sm:w-56"
              />
            </div>

            <div className="flex items-center bg-neutral-100 p-1 rounded-xl text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-150 active:scale-95 ${
                  statusFilter === 'all'
                    ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('success')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-150 active:scale-95 ${
                  statusFilter === 'success'
                    ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                    : 'text-neutral-500 hover:text-emerald-700'
                }`}
              >
                200 OK
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('error')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-150 active:scale-95 ${
                  statusFilter === 'error'
                    ? 'bg-white text-rose-700 shadow-2xs font-bold'
                    : 'text-neutral-500 hover:text-rose-700'
                }`}
              >
                Errors
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-neutral-200/90 shadow-2xs overflow-hidden">
          {filteredRecent.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <Terminal className="h-5 w-5" />
              </div>
              <div suppressHydrationWarning className="text-xs text-neutral-500 max-w-md mx-auto">
                {recent.length === 0
                  ? t.dashboard.noUsageHistory
                  : (isId ? 'Tidak ada riwayat pemanggilan yang cocok dengan filter.' : 'No request logs match your current filter.')}
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-mono uppercase text-neutral-500">
                      <th className="px-5 py-3.5 whitespace-nowrap">{t.dashboard.thUsageStatus}</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">{t.dashboard.thUsageTraceId}</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">{t.dashboard.thUsageModel}</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">{t.dashboard.thUsageTokens}</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">{t.dashboard.thUsageCredits}</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">{t.dashboard.thUsageLatency}</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">{t.dashboard.thUsageTime}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredRecent.map((r) => {
                      const isSuccess = r.status === 'success';
                      return (
                        <tr key={r.id} className="hover:bg-neutral-50/60 transition-colors">
                          {/* Status */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                isSuccess
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isSuccess ? (
                                <CheckCircle2 className="h-2.5 w-2.5" />
                              ) : (
                                <AlertCircle className="h-2.5 w-2.5" />
                              )}
                              <span>{isSuccess ? '200 OK' : r.status}</span>
                            </span>
                          </td>

                          {/* Trace ID */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {r.requestId ? (
                              <CopyTraceId id={r.requestId} />
                            ) : (
                              <span className="text-[11px] font-mono text-neutral-400">—</span>
                            )}
                          </td>

                          {/* Model */}
                          <td className="px-5 py-3.5 font-bold text-neutral-900 font-sans whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{r.model ?? r.publicModelId ?? (locale === 'en' ? 'Gateway' : 'Gerbang AI')}</span>
                              {r.streamed && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-neutral-100 text-neutral-600 font-mono font-normal">
                                  stream
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Tokens with breakdown */}
                          <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums">
                            <span className="font-bold text-neutral-900">
                              {r.totalTokens != null ? formatCredits(r.totalTokens) : '—'}
                            </span>
                            {(r.promptTokens != null || r.completionTokens != null) && (
                              <span className="text-[10px] text-neutral-500 block font-normal">
                                {r.promptTokens ?? 0} in / {r.completionTokens ?? 0} out
                              </span>
                            )}
                          </td>

                          {/* Cost */}
                          <td className="px-5 py-3.5 text-right font-bold text-neutral-900 whitespace-nowrap font-mono tabular-nums">
                            {formatCredits(r.credits)} cr
                          </td>

                          {/* Latency */}
                          <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums">
                            {r.latencyMs != null ? (
                              <span
                                className={`font-semibold ${
                                  r.latencyMs < 300
                                    ? 'text-emerald-700'
                                    : r.latencyMs < 1000
                                    ? 'text-neutral-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {r.latencyMs}ms
                              </span>
                            ) : (
                              <span className="text-neutral-500">—</span>
                            )}
                          </td>

                          {/* Time */}
                          <td
                            className="px-5 py-3.5 text-right text-neutral-500 whitespace-nowrap font-mono text-[11px]"
                            title={new Date(r.createdAt).toLocaleString(isId ? 'id-ID' : 'en-US')}
                          >
                            {timeAgo(r.createdAt, locale)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 bg-neutral-50/50">
                  <div className="text-xs text-neutral-500 font-mono flex items-center gap-2">
                    {isLoadingPage && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />}
                    <span>{locale === 'en' ? `Page ${page} of ${totalPages}` : `Halaman ${page} dari ${totalPages}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1 || isLoadingPage}
                      className="p-1.5 rounded-lg border border-neutral-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-neutral-700 cursor-pointer"
                      title={locale === 'en' ? 'Previous page' : 'Halaman sebelumnya'}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages || isLoadingPage}
                      className="p-1.5 rounded-lg border border-neutral-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-neutral-700 cursor-pointer"
                      title={locale === 'en' ? 'Next page' : 'Halaman berikutnya'}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
