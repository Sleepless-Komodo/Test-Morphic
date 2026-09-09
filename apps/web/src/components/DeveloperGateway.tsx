'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Check, Copy, Cpu, KeyRound, Zap } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatTokenEstimate } from '@/lib/utils';
import GatewayStatusPopover from '@/components/GatewayStatusPopover';
import QuickstartHub from '@/components/QuickstartHub';

const BASE_URL = 'https://api.morphic.sh/v1';

interface UsageSummary {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

interface DeveloperGatewayProps {
  userBalance?: number;
  activeKeys?: number;
  usage?: UsageSummary;
  modelCount?: number;
  avgCreditsPer1m?: number;
  minInputRate?: number;
}

export default function DeveloperGateway({
  userBalance = 0,
  activeKeys = 0,
  usage = { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
  modelCount = 0,
  avgCreditsPer1m = 0,
  minInputRate = 0,
}: DeveloperGatewayProps) {
  const { t, locale } = useTranslation();
  const [baseUrlCopied, setBaseUrlCopied] = useState(false);

  const copyBaseUrl = () => {
    navigator.clipboard.writeText(BASE_URL);
    setBaseUrlCopied(true);
    setTimeout(() => setBaseUrlCopied(false), 2000);
  };

  const estimatedTokens =
    avgCreditsPer1m > 0 ? Math.floor((userBalance / avgCreditsPer1m) * 1_000_000) : 0;
  const inputPct =
    usage.totalTokens > 0 ? Math.round((usage.promptTokens / usage.totalTokens) * 100) : 0;
  const outputPct = usage.totalTokens > 0 ? 100 - inputPct : 0;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200/70">
        <div>
          <h1 suppressHydrationWarning className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
            {t.dashboard.title}
          </h1>
          <p suppressHydrationWarning className="text-xs md:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
            {t.dashboard.desc}
          </p>
        </div>
        <GatewayStatusPopover />
      </div>

      {/* Row 1: Endpoint + Balance */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Base URL */}
        <div className="md:col-span-7 p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span suppressHydrationWarning className="text-xs font-semibold text-neutral-500">
                {t.dashboard.baseUrl}
              </span>
              <span suppressHydrationWarning className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                {t.dashboard.openAiCompatible}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 mb-3">
              <code className="font-mono font-bold text-xs sm:text-sm text-neutral-950 truncate select-all">
                {BASE_URL}
              </code>
              <button
                type="button"
                onClick={copyBaseUrl}
                className="p-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 active:scale-95 text-neutral-700 hover:text-black transition-all shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title={t.dashboard.copyBaseUrl}
              >
                {baseUrlCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span suppressHydrationWarning className="text-emerald-700 text-[11px]">{t.dashboard.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span suppressHydrationWarning className="text-[11px]">{t.dashboard.copy}</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <p suppressHydrationWarning className="text-xs text-neutral-500 leading-relaxed">
            {t.dashboard.baseUrlDesc}
          </p>
        </div>

        {/* Balance + Token Capacity */}
        <div className="md:col-span-5 p-6 rounded-3xl bg-neutral-950 text-white border border-neutral-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span suppressHydrationWarning className="text-xs font-semibold text-neutral-400">
                {t.dashboard.creditBalance}
              </span>
              <Zap className="h-4 w-4 text-emerald-500" />
            </div>
            <div suppressHydrationWarning className="text-2xl sm:text-3xl font-heading font-black text-white mb-1">
              Rp {userBalance.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')}
            </div>
            {userBalance > 0 && avgCreditsPer1m > 0 ? (
              <div className="font-mono text-sm font-bold text-emerald-400">
                ≈ {formatTokenEstimate(estimatedTokens)} {t.dashboard.tokenCapacityUnit}
              </div>
            ) : (
              <p suppressHydrationWarning className="text-xs text-neutral-400 leading-relaxed">
                {t.dashboard.zeroBalance}
              </p>
            )}
          </div>
          <Link
            href="/dashboard/billing"
            className="mt-4 w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center"
          >
            <span suppressHydrationWarning>{t.dashboard.topUp}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Row 2: Pulse Strip */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* API Keys */}
        <Link
          href="/dashboard/keys"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex items-center justify-between gap-3 hover:border-neutral-300 hover:shadow-sm transition-all group"
        >
          <div className="min-w-0">
            <div suppressHydrationWarning className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black truncate">
              {activeKeys} {t.dashboard.keysActiveCount}
            </div>
            <span suppressHydrationWarning className="text-xs text-neutral-500">
              {t.dashboard.activeKeys}
            </span>
          </div>
          <KeyRound className="h-5 w-5 text-neutral-400 group-hover:text-black transition-colors shrink-0" />
        </Link>

        {/* Tokens Used */}
        <Link
          href="/dashboard/usage"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black font-mono tracking-tight truncate">
                {formatTokenEstimate(usage.totalTokens)} Token
              </div>
              <span suppressHydrationWarning className="text-xs text-neutral-500">
                {usage.totalTokens > 0 ? t.dashboard.tokensUsedUnit : t.dashboard.noUsageYet}
              </span>
            </div>
            <ArrowUpRight className="h-4 w-4 text-neutral-400 group-hover:text-black transition-colors shrink-0" />
          </div>
          {usage.totalTokens > 0 && (
            <div className="mt-3">
              <div className="flex h-1.5 rounded-full bg-neutral-100 overflow-hidden mb-1.5">
                <div className="bg-neutral-950 transition-all" style={{ width: `${inputPct}%` }} />
                <div className="bg-neutral-300 transition-all" style={{ width: `${outputPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span>{t.dashboard.inputOutputLabel} {inputPct}% / {outputPct}%</span>
              </div>
            </div>
          )}
        </Link>

        {/* Model Catalog */}
        <Link
          href="/dashboard/models"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex items-center justify-between gap-3 hover:border-neutral-300 hover:shadow-sm transition-all group"
        >
          <div className="min-w-0">
            <div suppressHydrationWarning className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black truncate">
              {modelCount} {t.dashboard.modelsReadyCount}
            </div>
            <span suppressHydrationWarning className="text-xs text-neutral-500 font-mono">
              {minInputRate > 0
                ? `${t.dashboard.ratesFrom} Rp ${minInputRate.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')} / 1M token`
                : t.dashboard.modelsDesc}
            </span>
          </div>
          <Cpu className="h-5 w-5 text-neutral-400 group-hover:text-black transition-colors shrink-0" />
        </Link>
      </div>

      {/* Row 3: Quickstart */}
      <QuickstartHub />
    </div>
  );
}
