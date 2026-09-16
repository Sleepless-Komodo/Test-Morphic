'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Cpu,
  KeyRound,
  Zap,
  Activity,
  Terminal,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits, formatTokenEstimate, timeAgo, API_BASE_URL } from '@/lib/utils';
import GatewayStatusPopover from '@/components/GatewayStatusPopover';
import QuickstartHub from '@/components/QuickstartHub';
import { INFERENCE_MODELS, CapabilityTag, ModelItem } from '@/lib/models-data';
export type { ModelItem } from '@/lib/models-data';

const BASE_URL = API_BASE_URL;

const CHEAP_DAILY_PACKAGES = [
  { id: 'starter', label: 'Starter', labelEn: 'Starter', desc: 'Rp 10.000 / bulan', descEn: 'Rp 10,000 / month', credits: 10000 },
  { id: 'pro', label: 'Pro', labelEn: 'Pro', desc: 'Rp 25.000 / bulan', descEn: 'Rp 25,000 / month', credits: 25000 },
  { id: 'power', label: 'Power', labelEn: 'Power', desc: 'Rp 50.000 / bulan', descEn: 'Rp 50,000 / month', credits: 50000 },
] as const;

interface UsageSummary {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

export interface RecentRequestItem {
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

/**
 * Interface representing component props for DeveloperGateway.
 */
interface DeveloperGatewayProps {
  session?: unknown;
  userBalance?: number;
  /**
   * Optional initial models passed from the Server Component (fetched from PostgreSQL database).
   * If not provided or empty, the component will fall back to static default models.
   */
  initialModels?: ModelItem[];
  recentRequests?: RecentRequestItem[];
  /** Pre-computed server-side model stats to avoid client-side string parsing */
  serverModelCount?: number;
  serverAvgCreditsPer1m?: number;
  serverMinInputRate?: number;
}

export default function DeveloperGateway({
  session,
  userBalance = 0,
  initialModels,
  recentRequests: initialRecentRequests = [],
  serverModelCount,
  serverAvgCreditsPer1m,
  serverMinInputRate,
}: DeveloperGatewayProps) {
  const { t, locale } = useTranslation();
  const isId = locale === 'id';
  const [baseUrlCopied, setBaseUrlCopied] = useState(false);

  // Filter state
  const [selectedCapability, setSelectedCapability] = useState<CapabilityTag | 'All'>('All');
  const [selectedProvider, setSelectedProvider] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // API Key state
  const [keyName, setKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [keysList, setKeysList] = useState<{ id: string; name: string; key: string; date: string }[]>([]);

  // Voucher / balance state
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherSuccess, setVoucherSuccess] = useState<string | null>(null);
  const [balance, setBalance] = useState(userBalance);

  // Recent requests (may be overridden by real-time data in the future)
  const [recentRequests] = useState<RecentRequestItem[]>(initialRecentRequests);

  // Derived metrics from active model list
  const activeKeys = keysList.length;

  const getPackageDesc = (pkg: (typeof CHEAP_DAILY_PACKAGES)[number]) =>
    locale === 'en' && pkg.descEn ? pkg.descEn : pkg.desc;

  // Resolve dynamic model list: use database-fetched models if available, fallback to static defaults
  const activeModelList = useMemo(() => {
    return initialModels && initialModels.length > 0 ? initialModels : INFERENCE_MODELS;
  }, [initialModels]);

  // Derived metrics — prefer server-side pre-computed values (accurate, from real DB);
  // fall back to client-side parsing of dailyRate strings only for static INFERENCE_MODELS.
  const modelCount = serverModelCount ?? activeModelList.length;
  const minInputRate = useMemo(() => {
    if (serverMinInputRate !== undefined) return serverMinInputRate;
    const rates = activeModelList
      .map((m) => parseInt((m.dailyRate ?? '').replace(/[^0-9]/g, ''), 10))
      .filter((r) => !isNaN(r) && r > 0);
    return rates.length > 0 ? Math.min(...rates) : 0;
  }, [activeModelList, serverMinInputRate]);
  const avgCreditsPer1m = useMemo(() => {
    if (serverAvgCreditsPer1m !== undefined) return serverAvgCreditsPer1m;
    const rates = activeModelList
      .map((m) => parseInt((m.dailyRate ?? '').replace(/[^0-9]/g, ''), 10))
      .filter((r) => !isNaN(r) && r > 0);
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }, [activeModelList, serverAvgCreditsPer1m]);

  // Usage summary (placeholder — replace with real fetched data)
  const usage = useMemo<{ totalTokens: number; promptTokens: number; completionTokens: number }>(
    () => ({ totalTokens: 0, promptTokens: 0, completionTokens: 0 }),
    [],
  );

  const filteredModels = useMemo(
    () =>
      activeModelList.filter((m) => {
        const matchCap = selectedCapability === 'All' || m.capabilities.includes(selectedCapability as CapabilityTag);
        const matchProv = selectedProvider === 'All' || m.provider === selectedProvider;
        const matchSearch =
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.id.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCap && matchProv && matchSearch;
      }),
    [activeModelList, selectedCapability, selectedProvider, searchQuery],
  );

  const categories = useMemo(() => Array.from(new Set(filteredModels.map((m) => m.category))), [filteredModels]);

  const handleCreateKey = () => {
    if (!keyName.trim()) return;
    setIsCreatingKey(true);
    setTimeout(() => {
      const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setKeysList((prev) => [
        { id: `k-${Date.now()}`, name: keyName, key: `mp-live-${hex}`, date: locale === 'id' ? 'Baru saja' : 'Just now' },
        ...prev,
      ]);
      setKeyName('');
      setIsCreatingKey(false);
    }, 400);
  };

  const handleRedeemVoucher = () => {
    if (!voucherCode.trim()) return;
    const msg =
      locale === 'en'
        ? `Voucher "${voucherCode.toUpperCase()}" active! +Rp 5,000 balance added.`
        : `Kupon "${voucherCode.toUpperCase()}" aktif! +Rp 5.000 saldo ditambahkan.`;
    setVoucherSuccess(msg);
    setBalance((p) => p + 5000);
    setVoucherCode('');
    setTimeout(() => setVoucherSuccess(null), 5000);
  };

  const copyBaseUrl = () => {
    navigator.clipboard.writeText(BASE_URL).then(() => {
      setBaseUrlCopied(true);
      setTimeout(() => setBaseUrlCopied(false), 2000);
    });
  };

  const estimatedTokens =
    avgCreditsPer1m > 0 ? Math.floor((balance / avgCreditsPer1m) * 1_000_000) : 0;
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
                className="p-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-100 active:scale-95 text-neutral-700 hover:text-black transition-all shrink-0 shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
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
            <div suppressHydrationWarning className="text-2xl sm:text-3xl font-heading font-black text-white mb-1 font-mono tabular-nums">
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
            className="mt-4 w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
          >
            <span suppressHydrationWarning>{t.dashboard.topUp}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Row 2: Metric Pulse Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* API Keys */}
        <Link
          href="/dashboard/keys"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-sm transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div suppressHydrationWarning className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black truncate font-mono tabular-nums">
                {activeKeys} {t.dashboard.keysActiveCount}
              </div>
              <span suppressHydrationWarning className="text-xs text-neutral-500">
                {t.dashboard.activeKeys}
              </span>
            </div>
            <KeyRound className="h-4 w-4 text-neutral-400 group-hover:text-neutral-950 transition-colors shrink-0 mt-0.5" />
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] font-medium text-neutral-500 group-hover:text-neutral-950 transition-colors">
            <span>{locale === 'en' ? 'Manage Keys' : 'Kelola API Key'}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-950 transition-colors" />
          </div>
        </Link>

        {/* Tokens Used */}
        <Link
          href="/dashboard/usage"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-sm transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black font-mono tracking-tight truncate tabular-nums">
                {formatTokenEstimate(usage.totalTokens)} Token
              </div>
              <span suppressHydrationWarning className="text-xs text-neutral-500">
                {usage.totalTokens > 0 ? t.dashboard.tokensUsedUnit : t.dashboard.noUsageYet}
              </span>
            </div>
            <Activity className="h-4 w-4 text-neutral-400 group-hover:text-neutral-950 transition-colors shrink-0 mt-0.5" />
          </div>
          {usage.totalTokens > 0 ? (
            <div className="mt-3">
              <div className="flex h-1.5 rounded-full bg-neutral-100 overflow-hidden mb-1.5">
                <div className="bg-neutral-950 transition-all" style={{ width: `${inputPct}%` }} />
                <div className="bg-neutral-300 transition-all" style={{ width: `${outputPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 font-medium">
                <span>{t.dashboard.inputOutputLabel} {inputPct}% / {outputPct}%</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] font-medium text-neutral-500 group-hover:text-neutral-950 transition-colors">
              <span>{locale === 'en' ? 'View Usage Logs' : 'Lihat Log Pemakaian'}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-950 transition-colors" />
            </div>
          )}
        </Link>

        {/* Model Catalog */}
        <Link
          href="/dashboard/models"
          className="md:col-span-4 p-5 rounded-3xl bg-white border border-neutral-200/90 shadow-xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-sm transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div suppressHydrationWarning className="font-heading font-bold text-lg text-neutral-950 group-hover:text-black truncate font-mono tabular-nums">
                {modelCount} {t.dashboard.modelsReadyCount}
              </div>
              <span suppressHydrationWarning className="text-xs text-neutral-500 font-mono">
                {minInputRate > 0
                  ? `${t.dashboard.ratesFrom} Rp ${minInputRate.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')} / 1M`
                  : t.dashboard.modelsDesc}
              </span>
            </div>
            <Cpu className="h-4 w-4 text-neutral-400 group-hover:text-neutral-950 transition-colors shrink-0 mt-0.5" />
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] font-medium text-neutral-500 group-hover:text-neutral-950 transition-colors">
            <span>{locale === 'en' ? 'Explore Catalog' : 'Jelajahi Model'}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-950 transition-colors" />
          </div>
        </Link>
      </div>

      {/* Row 3: Live Request Telemetry & Logs Preview Table */}
      <div className="rounded-3xl bg-white border border-neutral-200/90 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-neutral-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <h2 className="font-heading font-bold text-base text-neutral-950 tracking-tight">
                {isId ? 'Telemetri Permintaan Terakhir' : 'Recent Request Telemetry'}
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {isId
                ? 'Riwayat pemanggilan model AI dari Cursor, Cline, dan kode Anda'
                : 'Live model invocations from your IDEs, coding agents, and SDKs'}
            </p>
          </div>

          <Link
            href="/dashboard/usage"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-950 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 rounded-lg py-1 px-2.5 hover:bg-neutral-100 transition-colors shrink-0 self-start sm:self-auto"
          >
            <span>{isId ? 'Lihat Semua Log Aktivitas' : 'View Full Logs & Analytics'}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-950 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="p-10 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
              <Terminal className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-sm text-neutral-900">
                {isId ? 'Belum Ada Permintaan API yang Masuk' : 'No API Requests Recorded Yet'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                {isId
                  ? `Hubungkan Base URL ${BASE_URL} dan API Key Anda di Cursor, Cline, atau SDK untuk melihat log real-time di sini.`
                  : `Configure Base URL ${BASE_URL} and your API Key in Cursor, Cline, or the SDK to see real-time request telemetry here.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-mono uppercase text-neutral-500">
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Trace ID</th>
                  <th className="px-5 py-3.5">Model</th>
                  <th className="px-5 py-3.5 text-right">Tokens</th>
                  <th className="px-5 py-3.5 text-right">Cost</th>
                  <th className="px-5 py-3.5 text-right">Latency</th>
                  <th className="px-5 py-3.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                {recentRequests.map((r) => {
                  const isSuccess = r.status === 'success';
                  return (
                    <tr key={r.id} className="hover:bg-neutral-50/60 transition-colors">
                      {/* Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                            <span>200 OK</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
                            <span>ERR</span>
                          </span>
                        )}
                      </td>

                      {/* Trace ID */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-neutral-500">
                        {r.requestId ? (
                          <span className="truncate block max-w-[100px]">{r.requestId.slice(0, 12)}…</span>
                        ) : (
                          <span className="text-neutral-400">{r.id.slice(0, 8)}…</span>
                        )}
                      </td>

                      {/* Model */}
                      <td className="px-5 py-3.5 font-bold text-neutral-900 font-sans whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{r.model ?? r.publicModelId ?? 'Gateway'}</span>
                          {r.streamed && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-neutral-100 text-neutral-600 font-mono font-normal">
                              stream
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tokens */}
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
                            className={
                              r.latencyMs < 300
                                ? 'text-emerald-700 font-semibold'
                                : r.latencyMs < 1000
                                ? 'text-neutral-700'
                                : 'text-amber-700'
                            }
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
        )}
      </div>

      {/* Row 4: Quickstart Hub */}
      <QuickstartHub />
    </div>
  );
}
