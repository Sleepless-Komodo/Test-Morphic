'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits, cn } from '@/lib/utils';
import {
  Zap,
  CreditCard,
  Clock,
  Wallet,
  Coins,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';
import { CheckoutModal } from './checkout-modal';

interface BillingViewProps {
  balance: number;
  packages: any[];
  entitlements: any[];
  payments: any[];
  ledger: any[];
}

export type BillingTier = 'all' | 'token' | 'package' | 'credit';

export function getPackageRoleInfo(pkg: any, isId: boolean) {
  const name = (pkg.name || '').toLowerCase();
  const desc = (pkg.description || '').toLowerCase();

  // 1. Package Pass (Time Pass / Dedicated Model)
  if (
    pkg.modelId != null ||
    (pkg.durationHours != null && pkg.durationHours <= 72) ||
    name.includes('day') ||
    name.includes('pass') ||
    name.includes('24h') ||
    name.includes('sprint') ||
    name.includes('hari') ||
    desc.includes('unlimited') ||
    desc.includes('fair use')
  ) {
    return {
      tier: 'package' as const,
      badge: isId ? '⚡ Paket Pass (Durasi)' : '⚡ Time Pass (Dedicated)',
      role: isId ? 'Role: Sprint Coder & Maraton' : 'Role: Sprint Coder & Marathon',
      roleDesc: isId
        ? 'Akses intensif 24 jam ke model unggulan dengan kebijakan Fair Use. Ideal untuk marathon koding.'
        : 'Dedicated 24-hour access to flagship models with fair-use allowance for high-focus coding sprints.',
      bestFor: isId ? 'Coding Marathon & Hackathon' : 'Coding Marathon & Sprint',
      allowanceLabel: isId ? 'Akses Penuh 24 Jam' : '24 Hours Full Access',
      accentColor: 'border-amber-200 bg-amber-50/50 text-amber-900',
      tagColor: 'bg-amber-100/90 text-amber-900 border-amber-300/80',
      badgeBg: 'bg-amber-500',
    };
  }

  // 2. Via Token (Direct Token Quota)
  if (
    name.includes('token') ||
    desc.includes('token') ||
    (pkg.creditAllowance && pkg.creditAllowance >= 1_000_000)
  ) {
    return {
      tier: 'token' as const,
      badge: isId ? '🪙 Kuota Token Murni' : '🪙 Direct Token Quota',
      role: isId ? 'Role: Integrator API & Otomasi' : 'Role: API Integrator & Automation',
      roleDesc: isId
        ? 'Kuota token murni untuk API integrasi, agent batch, dan CLI tanpa batasan harian ketat.'
        : 'Pure raw tokens for API calls, automated agent pipelines, and high-volume workloads.',
      bestFor: isId ? 'Integrasi API & Agent Otomasi' : 'API Workflows & Autonomous Agents',
      allowanceLabel: `${formatCredits(pkg.creditAllowance)} Tokens`,
      accentColor: 'border-indigo-200 bg-indigo-50/50 text-indigo-900',
      tagColor: 'bg-indigo-100/90 text-indigo-900 border-indigo-300/80',
      badgeBg: 'bg-indigo-500',
    };
  }

  // 3. Balance / Credit (Universal Multi-Model Wallet Top-Up)
  return {
    tier: 'credit' as const,
    badge: isId ? '💳 Saldo Kredit Universal' : '💳 Universal Wallet Credit',
    role: isId ? 'Role: Eksplorasi Multi-Model' : 'Role: Multi-Model Explorer',
    roleDesc: isId
      ? 'Saldo kredit akun fleksibel yang dapat dipakai bebas di seluruh katalog model AI (OpenAI, Claude, DeepSeek, Qwen).'
      : 'Flexible wallet balance usable across all AI models without strict expiration or model lock-in.',
    bestFor: isId ? 'Coba Semua Model & Pay-as-you-go' : 'Explore All Models & Pay-as-you-go',
    allowanceLabel: `+${formatCredits(pkg.creditAllowance)} Kredit`,
    accentColor: 'border-emerald-200 bg-emerald-50/50 text-emerald-900',
    tagColor: 'bg-emerald-100/90 text-emerald-900 border-emerald-300/80',
    badgeBg: 'bg-emerald-500',
  };
}

export function BillingView({
  balance: initialBalance,
  packages: initialPackages,
  entitlements,
  payments,
  ledger,
}: BillingViewProps) {
  const { t, locale } = useTranslation();
  const isId = locale === 'id';

  const [balance, setBalance] = useState(initialBalance);
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [resumePayment, setResumePayment] = useState<any>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<'IDR' | 'USD'>(isId ? 'IDR' : 'USD');
  const [selectedTier, setSelectedTier] = useState<BillingTier>('all');

  const paymentsList = payments ?? [];

  // Keep currency tab synced when user toggles website language
  useEffect(() => {
    setSelectedCurrency(isId ? 'IDR' : 'USD');
  }, [isId]);

  // Filter packages by active currency first
  const currencyPackages = useMemo(() => {
    return initialPackages.filter((p) => {
      const pkgCurr = p.currency === 'USD' ? 'USD' : 'IDR';
      return pkgCurr === selectedCurrency;
    });
  }, [initialPackages, selectedCurrency]);

  // Filter packages by selected role/tier
  const displayedPackages = useMemo(() => {
    if (selectedTier === 'all') return currencyPackages;
    return currencyPackages.filter((p) => {
      const info = getPackageRoleInfo(p, isId);
      return info.tier === selectedTier;
    });
  }, [currencyPackages, selectedTier, isId]);

  // Counts for each tier tab
  const counts = useMemo(() => {
    let token = 0;
    let pkgCount = 0;
    let credit = 0;

    currencyPackages.forEach((p) => {
      const info = getPackageRoleInfo(p, isId);
      if (info.tier === 'token') token++;
      else if (info.tier === 'package') pkgCount++;
      else credit++;
    });

    return { all: currencyPackages.length, token, package: pkgCount, credit };
  }, [currencyPackages, isId]);

  const handleSuccess = (creditsAdded: number) => {
    setBalance((prev) => prev + creditsAdded);
  };

  return (
    <div className="w-full space-y-8">
      {/* Header & Balance Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200/70">
        <div>
          <h1 suppressHydrationWarning className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
            {t.dashboard.billingPageTitle}
          </h1>
          <p suppressHydrationWarning className="text-xs md:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
            {isId
              ? 'Kelola opsi isi ulang dengan 3 skema: Kuota Token, Paket Pass Durasi, atau Saldo Kredit Fleksibel.'
              : 'Manage your AI billing via 3 distinct options: Direct Token Quota, Time Passes, or Flexible Credit Balance.'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900">
            <Wallet className="h-5 w-5 text-neutral-700" />
          </div>
          <div>
            <div suppressHydrationWarning className="text-[10px] uppercase font-mono text-neutral-500 font-bold">
              {t.dashboard.activeBalanceLabel}
            </div>
            <div className="text-xl font-extrabold text-neutral-950 font-mono">
              {formatCredits(balance)}{' '}
              <span suppressHydrationWarning className="text-xs text-neutral-500 font-sans font-normal">
                {locale === 'en' ? 'credits' : 'kredit'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Billing Tiers / Roles Section */}
      <div className="space-y-5">
        {/* Tier Controls & Currency Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* 3 Role Categories Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-2xl border border-neutral-200/90 overflow-x-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedTier('all')}
              className={cn(
                'px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                selectedTier === 'all'
                  ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                  : 'text-neutral-600 hover:text-neutral-950',
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isId ? 'Semua Opsi' : 'All Options'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-neutral-200/70 text-neutral-700">
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTier('token')}
              className={cn(
                'px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                selectedTier === 'token'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-neutral-600 hover:text-neutral-950',
              )}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>{isId ? '🪙 Via Token' : '🪙 Token Quota'}</span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                  selectedTier === 'token' ? 'bg-indigo-700 text-white' : 'bg-neutral-200/70 text-neutral-700',
                )}
              >
                {counts.token}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTier('package')}
              className={cn(
                'px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                selectedTier === 'package'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'text-neutral-600 hover:text-neutral-950',
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isId ? '⚡ Paket Pass' : '⚡ Package Pass'}</span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                  selectedTier === 'package' ? 'bg-amber-700 text-white' : 'bg-neutral-200/70 text-neutral-700',
                )}
              >
                {counts.package}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTier('credit')}
              className={cn(
                'px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                selectedTier === 'credit'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-neutral-600 hover:text-neutral-950',
              )}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isId ? '💳 Saldo Kredit' : '💳 Credit Balance'}</span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                  selectedTier === 'credit' ? 'bg-emerald-700 text-white' : 'bg-neutral-200/70 text-neutral-700',
                )}
              >
                {counts.credit}
              </span>
            </button>
          </div>

          {/* Currency Switcher */}
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            <div className="inline-flex p-1 bg-neutral-100 rounded-xl border border-neutral-200/90 text-xs font-mono font-bold">
              <button
                type="button"
                onClick={() => setSelectedCurrency('IDR')}
                className={cn(
                  'px-3 py-1 rounded-lg transition-all cursor-pointer',
                  selectedCurrency === 'IDR'
                    ? 'bg-white text-neutral-950 shadow-2xs font-extrabold'
                    : 'text-neutral-500 hover:text-neutral-900',
                )}
              >
                🇮🇩 IDR (Rp)
              </button>
              <button
                type="button"
                onClick={() => setSelectedCurrency('USD')}
                className={cn(
                  'px-3 py-1 rounded-lg transition-all cursor-pointer',
                  selectedCurrency === 'USD'
                    ? 'bg-white text-neutral-950 shadow-2xs font-extrabold'
                    : 'text-neutral-500 hover:text-neutral-900',
                )}
              >
                🌐 USD ($)
              </button>
            </div>

            <span className="hidden sm:inline-block text-[11px] font-mono font-bold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">
              {selectedCurrency === 'IDR' ? 'QRIS & Duitku' : 'PayPal & Cards'}
            </span>
          </div>
        </div>

        {/* Informative Role Banner */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
              {selectedTier === 'token' ? (
                <Coins className="w-4 h-4 text-indigo-600" />
              ) : selectedTier === 'package' ? (
                <Zap className="w-4 h-4 text-amber-600" />
              ) : selectedTier === 'credit' ? (
                <CreditCard className="w-4 h-4 text-emerald-600" />
              ) : (
                <Sparkles className="w-4 h-4 text-neutral-800" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-950 flex items-center gap-2">
                <span>
                  {selectedTier === 'token'
                    ? isId
                      ? 'Tipe: Kuota Token Murni'
                      : 'Tier: Raw Token Quota'
                    : selectedTier === 'package'
                      ? isId
                        ? 'Tipe: Paket Akses & Durasi'
                        : 'Tier: Time & Model Pass'
                      : selectedTier === 'credit'
                        ? isId
                          ? 'Tipe: Saldo Kredit Akun'
                          : 'Tier: Universal Wallet Credits'
                        : isId
                          ? '3 Pilihan Skema Pembelian AI'
                          : '3 AI Billing Models'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                  {selectedTier === 'token'
                    ? isId
                      ? 'Role: Integrator API'
                      : 'Role: API Integrator'
                    : selectedTier === 'package'
                      ? isId
                        ? 'Role: Sprint Coder'
                        : 'Role: Sprint Coder'
                      : selectedTier === 'credit'
                        ? isId
                          ? 'Role: Multi-Model Explorer'
                          : 'Role: Multi-Model Explorer'
                        : isId
                          ? 'Role-Based Tiers'
                          : 'Role-Based Tiers'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed">
                {selectedTier === 'token'
                  ? isId
                    ? 'Dihitung per token riil tanpa hangus harian. Sangat hemat untuk automasi API, CLI Cursor/Cline, dan webhook backend.'
                    : 'Billed strictly per token consumed with no strict daily expiration. Best for high-volume automated agents and API integrations.'
                  : selectedTier === 'package'
                    ? isId
                      ? 'Akses penuh 24 jam dengan batas Fair Use longgar. Cocok untuk menyelesaikan project besar atau marathon coding tanpa khawatir saldo terkuras.'
                      : 'Dedicated 24h uninterrupted access to top models. Best for hackathons, major refactors, and full-day coding sprints.'
                    : selectedTier === 'credit'
                      ? isId
                        ? 'Saldo fleksibel yang otomatis masuk ke akun Anda. Dapat digunakan untuk semua model (OpenAI, Claude, DeepSeek, Qwen) tanpa batasan.'
                        : 'Flexible pay-as-you-go balance added to your wallet. Use freely across the entire catalog of models.'
                      : isId
                        ? 'Pilih skema yang paling sesuai dengan kebutuhan: via Kuota Token untuk API, Paket Pass untuk ngoding maraton, atau Saldo Kredit untuk multi-model.'
                        : 'Choose the best match for your workflow: Raw Tokens for APIs, Time Passes for intensive coding, or Wallet Balance for multi-model flexibility.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono font-medium text-neutral-500">
            <span>
              {displayedPackages.length} {isId ? 'Paket Aktif' : 'Active Packages'}
            </span>
          </div>
        </div>

        {/* Empty State */}
        {displayedPackages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-8 text-center">
            <p className="text-sm font-semibold text-neutral-800">
              {locale === 'en'
                ? `No packages found for this selection.`
                : `Tidak ada paket untuk pilihan ini.`}
            </p>
            <p className="mt-1.5 text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              {locale === 'en'
                ? 'Try selecting a different tier tab or currency above.'
                : 'Coba pilih tab role atau mata uang lainnya di atas.'}
            </p>
          </div>
        )}

        {/* Packages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedPackages.map((p) => {
            const roleInfo = getPackageRoleInfo(p, isId);

            return (
              <div
                key={p.id}
                className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col justify-between hover:border-neutral-400 hover:shadow-xs transition-all relative overflow-hidden group"
              >
                {/* Top Role Header */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span
                      className={cn(
                        'text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border',
                        roleInfo.tagColor,
                      )}
                    >
                      {roleInfo.badge}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono font-medium">
                      {p.durationHours ? `${p.durationHours}h` : 'Flex'}
                    </span>
                  </div>

                  {/* Role Persona Tag */}
                  <div className="text-[11px] font-semibold text-neutral-700 flex items-center gap-1.5 mb-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full', roleInfo.badgeBg)} />
                    <span>{roleInfo.role}</span>
                  </div>

                  {/* Package Title */}
                  <h3 className="font-heading font-bold text-base text-neutral-950 mb-1">
                    {locale === 'en' && p.nameEn ? p.nameEn : p.name}
                  </h3>

                  {/* Price */}
                  <div className="text-xl font-extrabold text-neutral-950 mb-2 font-mono">
                    {p.currency === 'USD'
                      ? `$ ${(p.priceCents / 100).toFixed(2)} USD`
                      : `Rp ${(p.priceCents ?? 0).toLocaleString('id-ID')}`}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-neutral-600 leading-relaxed mb-3">
                    {p.description}
                  </p>

                  {/* Features Bullet List */}
                  <div className="space-y-1.5 pt-2 border-t border-neutral-100 text-[11px] text-neutral-600">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        {roleInfo.tier === 'token'
                          ? isId
                            ? 'Dihitung murni per token'
                            : 'Raw token per token billing'
                          : roleInfo.tier === 'package'
                            ? isId
                              ? 'Akses tanpa jeda 24 jam'
                              : 'Uninterrupted 24h access'
                            : isId
                              ? 'Bebas pakai di semua model AI'
                              : 'Works across all AI models'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        {isId
                          ? 'Dukungan Cursor, Cline & API Key'
                          : 'Compatible with Cursor, Cline & API'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Purchase Button */}
                <div className="pt-3 border-t border-neutral-100 mt-4">
                  <button
                    id={`buy-pkg-${p.id}`}
                    onClick={() => {
                      setSelectedPkg(p);
                      setResumePayment(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>
                      {isId ? `Pilih Paket (${p.currency})` : `Select Package (${p.currency})`}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checkout Modal — Duitku or PayPal payment */}
      {selectedPkg && (
        <CheckoutModal
          pkg={selectedPkg}
          existingPayment={resumePayment}
          onClose={() => {
            setSelectedPkg(null);
            setResumePayment(null);
          }}
          onSuccess={handleSuccess}
        />
      )}

      {/* Active Passes / Entitlements */}
      {entitlements.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-950" />
            <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">
              {t.dashboard.activePassesTitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entitlements.map((e) => {
              const allowance = e.allowance || e.remaining || 1;
              const remaining = Math.max(0, e.remaining ?? 0);
              const percentRemaining = Math.min(100, Math.max(0, Math.round((remaining / allowance) * 100)));

              return (
                <div
                  key={e.id}
                  className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-neutral-950">
                        {e.packageName ?? t.dashboard.billingActivePass}
                      </div>
                      <div suppressHydrationWarning className="text-[11px] text-neutral-500 font-mono mt-0.5">
                        {t.dashboard.expiresPrefix}{' '}
                        {e.expiresAt
                          ? new Date(e.expiresAt).toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : t.dashboard.billingToday}
                      </div>
                    </div>
                    <span suppressHydrationWarning className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{t.dashboard.activeStatusBadge}</span>
                    </span>
                  </div>

                  {/* Remaining Token Progress */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-neutral-500">{t.dashboard.activePassRemainingLabel}</span>
                      <span className="font-bold text-neutral-900 tabular-nums">
                        {formatCredits(remaining)} / {formatCredits(allowance)} ({percentRemaining}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-neutral-950 transition-all duration-300"
                        style={{ width: `${percentRemaining}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="space-y-3">
        <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">
          {t.dashboard.qrisHistoryTitle}
        </h2>
        <div className="rounded-2xl bg-white border border-neutral-200/90 shadow-2xs overflow-hidden">
          {paymentsList.length === 0 ? (
            <div suppressHydrationWarning className="p-8 text-center text-xs text-neutral-500 font-mono">
              {t.dashboard.noPaymentsHistory}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr suppressHydrationWarning className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-mono uppercase text-neutral-500">
                    <th className="px-5 py-3">{t.dashboard.billingPaymentDate}</th>
                    <th className="px-5 py-3">{t.dashboard.billingPaymentPackage}</th>
                    <th className="px-5 py-3">{t.dashboard.billingPaymentAmount}</th>
                    <th className="px-5 py-3">{t.dashboard.billingPaymentStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 text-neutral-500">
                        {new Date(p.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID')}
                      </td>
                      <td className="px-5 py-3 font-bold text-neutral-900">
                        {p.packageName ?? (locale === 'en' ? 'Top-up' : 'Isi Ulang')}
                      </td>
                      <td className="px-5 py-3 font-mono">
                        {p.currency === 'USD'
                          ? `$ ${(p.amountCents / 100).toFixed(2)} USD`
                          : `Rp ${(p.amountCents ?? 0).toLocaleString('id-ID')}`}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            suppressHydrationWarning
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                              p.status === 'paid' || p.status === 'success' || p.status === 'settlement'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'pending' || p.status === 'pending_paypal'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-neutral-100 text-neutral-800'
                            }`}
                          >
                            {p.status === 'success' || p.status === 'settlement' || p.status === 'paid'
                              ? locale === 'en'
                                ? 'Success'
                                : 'Berhasil'
                              : p.status === 'pending_paypal'
                                ? locale === 'en'
                                  ? 'Under Review'
                                  : 'Sedang Ditinjau'
                                : p.status === 'pending'
                                  ? locale === 'en'
                                    ? 'Pending'
                                    : 'Menunggu'
                                  : p.status}
                          </span>

                          {(p.status === 'pending' || p.status === 'pending_paypal') && (
                            <button
                              id={`continue-pay-btn-${p.id}`}
                              onClick={() => {
                                const pkgToOpen = initialPackages.find((pkg) => pkg.id === p.packageId) ?? {
                                  id: p.packageId ?? p.id,
                                  name: p.packageName ?? (locale === 'en' ? 'Top-up Package' : 'Paket Kredit'),
                                  priceCents: p.amountCents,
                                  currency: p.currency ?? 'IDR',
                                  creditAllowance: p.credits,
                                };
                                setSelectedPkg(pkgToOpen);
                                setResumePayment({
                                  id: p.id,
                                  externalId: p.externalId,
                                  provider: p.provider,
                                  status: p.status,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <CreditCard className="h-3 w-3" />
                              <span suppressHydrationWarning>{locale === 'en' ? 'Pay Now' : 'Lanjutkan Bayar'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Credit Ledger History */}
      <div className="space-y-3">
        <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">
          {t.dashboard.ledgerHistoryTitle}
        </h2>
        <div className="rounded-2xl bg-white border border-neutral-200/90 shadow-2xs overflow-hidden">
          {ledger.length === 0 ? (
            <div suppressHydrationWarning className="p-8 text-center text-xs text-neutral-500 font-mono">
              {t.dashboard.noLedgerHistory}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr suppressHydrationWarning className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-mono uppercase text-neutral-500">
                    <th className="px-5 py-3">{t.dashboard.thLedgerType}</th>
                    <th className="px-5 py-3">{t.dashboard.thLedgerAmount}</th>
                    <th className="px-5 py-3">{t.dashboard.thLedgerRef}</th>
                    <th className="px-5 py-3">{t.dashboard.thLedgerDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-5 py-3 font-mono font-bold text-neutral-800">
                        {entry.entry_type}
                      </td>
                      <td
                        className={`px-5 py-3 font-mono font-bold ${
                          entry.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {entry.amount >= 0 ? '+' : ''}
                        {entry.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-neutral-500 max-w-[200px] truncate">
                        {entry.reference ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-neutral-500 font-mono whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
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
