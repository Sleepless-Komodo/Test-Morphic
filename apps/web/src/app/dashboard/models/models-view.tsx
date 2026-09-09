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
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
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
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                selectedCap === cap.id
                  ? 'bg-neutral-950 text-white shadow-2xs'
                  : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
              }`}
            >
              <span suppressHydrationWarning>{cap.label}</span>
            </button>
          ))}
        </div>
        <div suppressHydrationWarning className="text-xs font-mono text-neutral-400 pl-2">
          {filtered.length} {t.dashboard.activeModelsSuffix}
        </div>
      </div>

      {/* Grid of Models */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m: any) => {
          const dailyRateFormatted =
            locale === 'en'
              ? (m.dailyRateEn ?? (m.dailyRate ?? 'From Rp 2,500 / day')).replace('/ hari', '/ day')
              : (m.dailyRate ?? 'Mulai Rp 2.500 / hari');
          const descriptionText = (locale === 'en' && m.descriptionEn) ? m.descriptionEn : m.description;

          return (
            <div
              key={m.publicModelId}
              className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-xs transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-heading font-bold text-base text-neutral-950">{m.displayName}</h3>
                    <div className="text-[10px] text-neutral-400 font-mono">{m.providerName ?? (locale === 'en' ? 'Official' : 'Resmi')}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200">
                    {t.dashboard.modelStatusReady}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <code className="text-[11px] font-mono text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                    {m.publicModelId}
                  </code>
                  <button
                    onClick={() => copyId(m.publicModelId)}
                    className="p-1 rounded-md text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer"
                    title={t.dashboard.copy}
                  >
                    {copiedId === m.publicModelId ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-neutral-600 leading-relaxed mb-4">{descriptionText}</p>

                <div className="flex gap-1.5 flex-wrap mb-4">
                  {(m.capabilities ?? []).map((cap: string) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-neutral-100 text-neutral-700 border border-neutral-200 capitalize"
                    >
                      {cap.replace('-', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">{t.dashboard.dailyRateLabel}</span>
                  <span className="font-bold font-mono text-neutral-950">{dailyRateFormatted}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                  <span>{formatCredits(m.contextLength)} {t.dashboard.context.replace(':', '').trim().toLowerCase()}</span>
                  <span>{locale === 'en' ? 'in' : 'masuk'} {formatCredits(m.inputCreditsPer1m)} / {locale === 'en' ? 'out' : 'keluar'} {formatCredits(m.outputCreditsPer1m)}</span>
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
