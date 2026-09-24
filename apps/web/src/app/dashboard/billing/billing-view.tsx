'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits } from '@/lib/utils';
import { Zap, CreditCard, Clock } from 'lucide-react';
import { CheckoutModal } from './checkout-modal';

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
  const { t, locale } = useTranslation();
  const [balance, setBalance] = useState(initialBalance);
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [resumePayment, setResumePayment] = useState<any>(null);

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
            <Zap className="h-5 w-5 text-emerald-600" />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialPackages.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col justify-between hover:border-neutral-300 hover:shadow-xs transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                    {p.durationHours === 24 ? t.dashboard.duration24h : t.dashboard.flexibleDuration}
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">
                    {p.durationHours ? `${p.durationHours}h` : 'Flex'}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-base text-neutral-950 mb-1">
                  {locale === 'en' && p.nameEn ? p.nameEn : p.name}
                </h3>
                <div className="text-xl font-extrabold text-neutral-950 mb-2 font-mono">
                  {p.currency === 'USD'
                    ? `$ ${(p.priceCents / 100).toFixed(2)} USD`
                    : `Rp ${(p.priceCents ?? 0).toLocaleString('id-ID')}`}
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                  {locale === 'en' && p.descriptionEn ? p.descriptionEn : p.description}
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                <div className="text-xs font-mono text-neutral-500">
                  +{formatCredits(p.creditAllowance)} <span suppressHydrationWarning>{locale === 'en' ? 'credits' : 'kredit'}</span>
                </div>
                <button
                  id={`buy-pkg-${p.id}`}
                  onClick={() => {
                    setSelectedPkg(p);
                    setResumePayment(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span suppressHydrationWarning>
                    {p.currency === 'USD'
                      ? (locale === 'en' ? 'Pay via PayPal' : 'Bayar via PayPal')
                      : t.dashboard.buyPackageBtn}
                  </span>
                </button>
              </div>
            </div>
          ))}
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
            <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">{t.dashboard.activePassesTitle}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entitlements.map((e) => (
              <div
                key={e.id}
                className="p-4 rounded-xl bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-neutral-900">{e.packageName ?? (locale === 'en' ? 'Active Pass' : 'Pass Aktif')}</div>
                  <div suppressHydrationWarning className="text-[11px] text-neutral-500">
                    {t.dashboard.expiresPrefix}{' '}
                    {e.expiresAt ? new Date(e.expiresAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'id-ID') : (locale === 'en' ? 'Today' : 'Hari Ini')}
                  </div>
                </div>
                <span suppressHydrationWarning className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-neutral-950 text-white">
                  {t.dashboard.activeStatusBadge}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="space-y-3">
        <h2 suppressHydrationWarning className="font-heading font-bold text-base text-neutral-950">{t.dashboard.qrisHistoryTitle}</h2>
        <div className="rounded-2xl bg-white border border-neutral-200/90 shadow-2xs overflow-hidden">
          {payments.length === 0 ? (
            <div suppressHydrationWarning className="p-8 text-center text-xs text-neutral-500 font-mono">
              {t.dashboard.noPaymentsHistory}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr suppressHydrationWarning className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-mono uppercase text-neutral-500">
                    <th className="px-5 py-3">{locale === 'en' ? 'Date' : 'Tanggal'}</th>
                    <th className="px-5 py-3">{locale === 'en' ? 'Package' : 'Paket'}</th>
                    <th className="px-5 py-3">{locale === 'en' ? 'Amount' : 'Nominal'}</th>
                    <th className="px-5 py-3">{locale === 'en' ? 'Status' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 text-neutral-500">
                        {new Date(p.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID')}
                      </td>
                      <td className="px-5 py-3 font-bold text-neutral-900">{p.packageName ?? (locale === 'en' ? 'Top-up' : 'Isi Ulang')}</td>
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
                              ? (locale === 'en' ? 'Success' : 'Berhasil')
                              : p.status === 'pending_paypal'
                              ? (locale === 'en' ? 'Under Review' : 'Sedang Ditinjau')
                              : p.status === 'pending'
                              ? (locale === 'en' ? 'Pending' : 'Menunggu')
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
