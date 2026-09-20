'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { formatCredits } from '@/lib/utils';
import { Wallet, CreditCard, Clock, QrCode, RefreshCw } from 'lucide-react';
import { CheckoutModal } from './checkout-modal';
import { fetchBackendApi } from '@/lib/api-client';

interface BillingViewProps {
  balance: number;
  packages: any[];
  entitlements: any[];
  payments: any[];
  ledger: any[];
}

export function BillingView({
  balance: initialBalance,
  packages: initialPackages,
  entitlements,
  payments,
  ledger,
}: BillingViewProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [balance, setBalance] = useState(initialBalance);
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [paymentsList, setPaymentsList] = useState(payments);
  const [checkingPaymentId, setCheckingPaymentId] = useState<string | null>(null);

  const handleCheckPaymentStatus = async (paymentId: string) => {
    setCheckingPaymentId(paymentId);
    try {
      const res = await fetchBackendApi<{ status: string; credits?: number }>(`/v1/payments/${paymentId}`);
      if (res.data?.status) {
        setPaymentsList((prev) =>
          prev.map((p) => (p.id === paymentId ? { ...p, status: res.data!.status } : p))
        );
        if (res.data.status === 'paid' || res.data.status === 'success' || res.data.status === 'settlement') {
          if (res.data.credits) {
            setBalance((prev) => prev + res.data!.credits!);
          }
          router.refresh();
        }
      }
    } catch (err) {
      console.warn('[handleCheckPaymentStatus] Error checking payment:', err);
    } finally {
      setCheckingPaymentId(null);
    }
  };

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
            {t.dashboard.billingPageSubtitle}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900">
            <Wallet className="h-5 w-5 text-neutral-700" />
          </div>
          <div>
            <div suppressHydrationWarning className="text-[10px] uppercase font-mono text-neutral-400 font-bold">
              {t.dashboard.activeBalanceLabel}
            </div>
            <div className="text-xl font-extrabold text-neutral-950 font-mono">
              {formatCredits(balance)} <span suppressHydrationWarning className="text-xs text-neutral-500 font-sans font-normal">{locale === 'en' ? 'credits' : 'kredit'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Passes & Cheap Packages Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-neutral-950" />
            <h2 className="font-heading font-bold text-lg text-neutral-950">
              {t.dashboard.billingPackagesTitle}
            </h2>
          </div>
          <span className="text-[11px] font-mono font-bold text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">
            {t.dashboard.scanQrisInstantBadge}
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,235px))] gap-3.5">
          {initialPackages.map((p) => {
            const pkgName = locale === 'en' && p.nameEn ? p.nameEn : p.name;
            const pkgDesc = locale === 'en' && p.descriptionEn ? p.descriptionEn : p.description;

            return (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs hover:border-neutral-950 hover:shadow-xs transition-all flex flex-col justify-between group min-h-[190px]"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200/80">
                      {p.durationHours ? `${p.durationHours}h Pass` : t.dashboard.billingPassLabel}
                    </span>
                    <span className="text-[11px] font-mono font-extrabold text-emerald-600">
                      +{formatCredits(p.creditAllowance)}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-xs text-neutral-950 line-clamp-1 mb-0.5" title={pkgName}>
                    {pkgName}
                  </h3>
                  <div className="text-base font-extrabold text-neutral-950 font-mono tracking-tight tabular-nums">
                    Rp {(p.priceCents ?? 0).toLocaleString('id-ID')}
                  </div>
                  {pkgDesc && (
                    <p className="text-[10px] text-neutral-500 leading-snug line-clamp-2 mt-1.5 min-h-[26px]" title={pkgDesc}>
                      {pkgDesc}
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-neutral-100 mt-2.5">
                  <button
                    id={`buy-pkg-${p.id}`}
                    onClick={() => setSelectedPkg(p)}
                    className="w-full py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <QrCode className="h-3 w-3" />
                    <span suppressHydrationWarning>{t.dashboard.buyPackageBtn}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checkout Modal — real Duitku payment */}
      {selectedPkg && (
        <CheckoutModal
          pkg={selectedPkg}
          onClose={() => setSelectedPkg(null)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Active Passes / Entitlements */}
      {entitlements.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-950" />
            <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">{t.dashboard.activePassesTitle}</h2>
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
        <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">{t.dashboard.qrisHistoryTitle}</h2>
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
                  {paymentsList.map((p) => {
                    const isSuccess = p.status === 'success' || p.status === 'settlement' || p.status === 'paid';
                    const isPending = p.status === 'pending';

                    return (
                      <tr key={p.id}>
                        <td className="px-5 py-3 text-neutral-500">
                          {new Date(p.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID')}
                        </td>
                        <td className="px-5 py-3 font-bold text-neutral-900">{p.packageName ?? t.dashboard.billingTopup}</td>
                        <td className="px-5 py-3 font-mono">Rp {(p.amountCents ?? 0).toLocaleString('id-ID')}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-700">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isSuccess
                                  ? 'bg-emerald-500'
                                  : isPending
                                  ? 'bg-amber-500'
                                  : 'bg-neutral-400'
                              }`} />
                              <span suppressHydrationWarning>
                                {isSuccess
                                  ? t.dashboard.billingStatusSuccess
                                  : isPending
                                  ? t.dashboard.billingStatusPending
                                  : p.status}
                              </span>
                            </span>
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleCheckPaymentStatus(p.id)}
                                disabled={checkingPaymentId === p.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-200 bg-white hover:bg-neutral-100 text-[10px] font-semibold text-neutral-700 transition cursor-pointer active:scale-95 disabled:opacity-50 shadow-2xs"
                                title={t.dashboard.billingCheckStatus}
                              >
                                <RefreshCw className={`h-2.5 w-2.5 ${checkingPaymentId === p.id ? 'animate-spin text-neutral-500' : ''}`} />
                                <span>{checkingPaymentId === p.id ? t.dashboard.billingChecking : t.dashboard.billingCheckStatus}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                      <td className={`px-5 py-3 font-mono font-bold ${
                        entry.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-neutral-500 max-w-[200px] truncate">
                        {entry.reference ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-neutral-400 font-mono whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString(
                          locale === 'en' ? 'en-US' : 'id-ID',
                          { dateStyle: 'short', timeStyle: 'short' }
                        )}
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
