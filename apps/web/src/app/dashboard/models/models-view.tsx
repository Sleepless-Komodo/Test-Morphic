'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits } from '@/lib/utils';
import { Search, Terminal, Copy, Check, Sparkles, Cpu } from 'lucide-react';

export function ModelsView({ initialModels }: { initialModels: any[] }) {
  const { t, locale } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedCap, setSelectedCap] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = useMemo(() => {
    return initialModels.filter((m) => {
      const matchSearch =
        m.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        m.publicModelId?.toLowerCase().includes(search.toLowerCase()) ||
        m.providerName?.toLowerCase().includes(search.toLowerCase());

      const matchCap =
        selectedCap === 'All' ||
        (m.capabilities && m.capabilities.some((c: string) => c.toLowerCase() === selectedCap.toLowerCase()));

      return matchSearch && matchCap;
    });
  }, [initialModels, search, selectedCap]);

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200/70 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 suppressHydrationWarning className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
            {t.dashboard.modelsPageTitle}
          </h1>
          <p suppressHydrationWarning className="text-xs md:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
            {t.dashboard.modelsPageSubtitle}
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.dashboard.modelsSearchPlaceholder}
            className="w-full pl-9.5 pr-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-black transition-colors shadow-2xs"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
          {[
            { id: 'All', label: t.dashboard.filterAllCap },
            { id: 'coding', label: locale === 'en' ? 'Code' : 'Coding' },
            { id: 'reasoning', label: locale === 'en' ? 'Reasoning' : 'Penalaran' },
            { id: 'chat', label: locale === 'en' ? 'Chat' : 'Percakapan' },
            { id: 'multimodal', label: 'Multimodal' },
          ].map((cap) => (
            <button
              key={cap.id}
              onClick={() => setSelectedCap(cap.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95 cursor-pointer ${
                selectedCap === cap.id
                  ? 'bg-neutral-950 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
              }`}
            >
              <span suppressHydrationWarning>{cap.label}</span>
            </button>
          ))}
        </div>
        <div suppressHydrationWarning className="text-xs font-mono text-neutral-500 font-medium pl-2">
          {filtered.length} {t.dashboard.activeModelsSuffix}
        </div>
      </div>

      {/* Grid of Models (High-density compact square cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(195px,225px))] gap-3">
        {filtered.map((m: any) => {
          const dailyRateFormatted =
            locale === 'en'
              ? (m.dailyRateEn ?? (m.dailyRate ?? 'From Rp 2,500 / day')).replace('/ hari', '/ day')
              : (m.dailyRate ?? 'Mulai Rp 2.500 / hari');
          const descriptionText = (locale === 'en' && m.descriptionEn) ? m.descriptionEn : m.description;

          return (
            <div
              key={m.publicModelId}
              className="p-3.5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col justify-between hover:border-neutral-900/30 hover:shadow-xs transition-all group min-w-0 min-h-[205px] max-h-[220px]"
            >
              <div>
                {/* Provider + Status */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider font-semibold truncate">
                    {m.providerName ?? (locale === 'en' ? 'Official' : 'Resmi')}
                  </span>
                  {m.circuitBreakerState?.state === 'open' ? (
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0"
                      title={locale === 'en' ? 'Upstream degraded, automatically routed via fallback provider' : 'Upstream terganggu, otomatis dialihkan via rute cadangan'}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>{locale === 'en' ? 'Fallback' : 'Cadangan'}</span>
                    </span>
                  ) : m.circuitBreakerState?.state === 'half-open' ? (
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 shrink-0"
                      title={locale === 'en' ? 'Upstream recovering, testing trial queries' : 'Upstream dalam pemulihan'}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                      <span>{locale === 'en' ? 'Testing' : 'Pemulihan'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{t.dashboard.modelStatusReady}</span>
                    </span>
                  )}
                </div>

                {/* Model Title */}
                <h3 className="font-heading font-bold text-xs sm:text-[13px] text-neutral-950 truncate" title={m.displayName}>
                  {m.displayName}
                </h3>

                {/* Model ID Pill with 1-click copy */}
                <div
                  onClick={() => copyId(m.publicModelId)}
                  title={t.dashboard.copy}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && copyId(m.publicModelId)}
                  className="group/id my-1.5 flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-neutral-50 hover:bg-neutral-100/90 border border-neutral-200/70 cursor-pointer transition-colors"
                >
                  <code className="text-[10px] font-mono text-neutral-700 truncate select-all">
                    {m.publicModelId}
                  </code>
                  <span className="shrink-0 text-neutral-400 group-hover/id:text-neutral-900 transition-colors">
                    {copiedId === m.publicModelId ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </span>
                </div>

                {/* Description (Single line to keep card height clean and square) */}
                <p className="text-[10px] text-neutral-500 leading-snug line-clamp-1 mb-2" title={descriptionText}>
                  {descriptionText}
                </p>

                {/* Capabilities (Top 2 tags) */}
                <div className="flex gap-1 flex-wrap mb-2">
                  {(m.capabilities ?? []).slice(0, 2).map((cap: string) => (
                    <span
                      key={cap}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-neutral-100/80 text-neutral-600 border border-neutral-200/60 capitalize"
                    >
                      {cap.replace('-', ' ')}
                    </span>
                  ))}
                  {(m.capabilities?.length ?? 0) > 2 && (
                    <span className="px-1 py-0.5 rounded text-[9px] font-mono text-neutral-400">
                      +{(m.capabilities?.length ?? 0) - 2}
                    </span>
                  )}
                </div>
              </div>

              {/* Pricing & Context Specs Footer */}
              <div className="pt-2 border-t border-neutral-100 mt-auto space-y-0.5">
                <div className="flex items-baseline justify-between gap-1 text-[10.5px]">
                  <span className="text-neutral-400 truncate text-[10px]">{t.dashboard.dailyRateLabel}</span>
                  <span className="font-bold font-mono text-neutral-950 text-[11px] shrink-0">{dailyRateFormatted}</span>
                </div>
                <div className="flex items-center justify-between text-[9.5px] text-neutral-400 font-mono">
                  <span>{formatCredits(m.contextLength)} ctx</span>
                  <span className="truncate">
                    {locale === 'en' ? 'in' : 'msk'} {formatCredits(m.inputCreditsPer1m)} / {locale === 'en' ? 'out' : 'klr'} {formatCredits(m.outputCreditsPer1m)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal cURL Guide */}
      <div className="p-6 rounded-3xl bg-neutral-950 text-white border border-neutral-800 shadow-md space-y-2">
        <div className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
          <Terminal className="h-4 w-4 text-neutral-400" />
          <span>{t.dashboard.curlSampleTitle}</span>
        </div>
        <pre className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs overflow-x-auto font-mono leading-relaxed">{`curl https://api.morphic.sh/v1/chat/completions \\
  -H "Authorization: Bearer mp-live-xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "deepseek-v4", "messages": [{"role": "user", "content": "Hello Morphic"}]}'`}</pre>
      </div>
    </div>
  );
}
