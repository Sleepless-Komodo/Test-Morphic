'use client';

import { useTranslation } from '@/lib/i18n';
import { formatCredits, timeAgo } from '@/lib/utils';
import { BarChart3, Activity, Zap, Cpu, Clock, Terminal } from 'lucide-react';

interface UsageViewProps {
  today: { credits: number };
  month: { credits: number };
  total: { requests: number };
  topModels: Array<{ model: string; credits: number; requests: number }>;
  recent: Array<{
    id: string;
    model: string;
    totalTokens: number;
    credits: number;
    status: string;
    streamed: boolean;
    latencyMs: number;
    createdAt: Date;
  }>;
}

export function UsageView({ today, month, total, topModels, recent }: UsageViewProps) {
  const { t, locale } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200/70 pb-4">
        <div suppressHydrationWarning className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold mb-1">
          {locale === 'en' ? 'Morphic Developer Console / Telemetry' : 'Konsol Pengembang Morphic / Telemetri'}
        </div>
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
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
              {t.dashboard.usageToday}
            </span>
            <Zap className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-3xl font-heading font-black text-neutral-950 font-mono">
              {formatCredits(today?.credits ?? 0)}
            </div>
            <div className="text-xs text-neutral-400 mt-1 font-mono">{t.dashboard.usageCreditsUnit}</div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
              {t.dashboard.usageThisMonth}
            </span>
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="text-3xl font-heading font-black text-neutral-950 font-mono">
              {formatCredits(month?.credits ?? 0)}
            </div>
            <div className="text-xs text-neutral-400 mt-1 font-mono">{t.dashboard.usageCreditsUnit}</div>
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
            <div className="text-3xl font-heading font-black text-white font-mono">
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
              <tbody className="divide-y divide-neutral-100 font-mono">
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

      {/* Recent Activity Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-950" />
          <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">
            {t.dashboard.usageRecentTitle}
          </h2>
        </div>

        <div className="rounded-3xl bg-white border border-neutral-200/90 shadow-2xs overflow-hidden">
          {recent.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <Terminal className="h-5 w-5" />
              </div>
              <div suppressHydrationWarning className="text-xs text-neutral-500 max-w-md mx-auto">
                {t.dashboard.noUsageHistory}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr suppressHydrationWarning className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-mono uppercase text-neutral-500">
                    <th className="px-6 py-3.5">{t.dashboard.thUsageModel}</th>
                    <th className="px-6 py-3.5 text-right">{t.dashboard.thUsageTokens}</th>
                    <th className="px-6 py-3.5 text-right">{t.dashboard.thUsageCredits}</th>
                    <th className="px-6 py-3.5">{t.dashboard.thUsageLatency}</th>
                    <th className="px-6 py-3.5 text-right">{t.dashboard.thUsageTime}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                  {recent.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50/50">
                      <td className="px-6 py-3.5 font-bold text-neutral-900 font-sans flex items-center gap-2">
                        <span>{r.model ?? (locale === 'en' ? 'Gateway' : 'Gerbang AI')}</span>
                        {r.streamed && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-neutral-100 text-neutral-600 font-mono">
                            stream
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right text-neutral-500">
                        {r.totalTokens != null ? formatCredits(r.totalTokens) : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-neutral-900">
                        {formatCredits(r.credits)}
                      </td>
                      <td className="px-6 py-3.5 text-neutral-500">
                        {r.latencyMs != null ? `${r.latencyMs}ms` : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right text-neutral-400">
                        {timeAgo(r.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
