'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits } from '@/lib/utils';
import { Zap, CreditCard, Clock, QrCode, CheckCircle2, RefreshCw } from 'lucide-react';

interface BillingViewProps {
  balance: number;
  packages: any[];
  entitlements: any[];
  payments: any[];
}

export function BillingView({
  balance: initialBalance,
  packages: initialPackages,
  entitlements,
  payments,
}: BillingViewProps) {
  const { t, locale } = useTranslation();
  const [balance, setBalance] = useState(initialBalance);
  const [selectedPkg, setSelectedPkg] = useState<any>(initialPackages[0]);
  const [showModal, setShowModal] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  const handleSimulatePayment = () => {
    setPaymentDone(true);
    const addedCredits = selectedPkg?.creditAllowance ?? 15000;
    setBalance((p) => p + addedCredits);
    setTimeout(() => {
      setPaymentDone(false);
      setShowModal(false);
    }, 1500);
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
                  Rp {(p.priceCents ?? 0).toLocaleString('id-ID')}
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
                  onClick={() => {
                    setSelectedPkg(p);
                    setShowModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span suppressHydrationWarning>{t.dashboard.buyPackageBtn}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QRIS Modal */}
      {showModal && selectedPkg && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-neutral-200 max-w-sm w-full p-6 text-center shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 ease-out">
            <div className="flex items-center justify-between border-b pb-3">
              <div suppressHydrationWarning className="text-xs font-bold text-neutral-500 uppercase font-mono">{t.dashboard.checkoutQris}</div>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-black text-sm cursor-pointer">
                ✕
              </button>
            </div>

            <div>
              <h3 className="font-heading font-bold text-lg text-neutral-950">
                {locale === 'en' && selectedPkg.nameEn ? selectedPkg.nameEn : selectedPkg.name}
              </h3>
              <div className="text-2xl font-black text-neutral-950 mt-1 font-mono">
                Rp {(selectedPkg.priceCents ?? 0).toLocaleString('id-ID')}
              </div>
              <p suppressHydrationWarning className="text-xs text-neutral-500 mt-1">{t.dashboard.scanQrisDesc}</p>
            </div>

            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 inline-block mx-auto">
              <div className="w-40 h-40 bg-white border border-neutral-200 rounded-xl flex flex-col items-center justify-center text-neutral-900 p-2 mx-auto">
                <QrCode className="h-24 w-24 text-neutral-950" />
                <span className="text-[9px] font-mono text-neutral-400 mt-1">QRIS.NMID.00941829</span>
              </div>
            </div>

            {paymentDone ? (
              <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-900 text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span suppressHydrationWarning>{t.dashboard.paymentSuccess}</span>
              </div>
            ) : (
              <button
                onClick={handleSimulatePayment}
                className="w-full py-3 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <span suppressHydrationWarning>{t.dashboard.confirmPayment}</span>
              </button>
            )}
          </div>
        </div>
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
                      <td className="px-5 py-3 font-mono">Rp {(p.amountCents ?? 0).toLocaleString('id-ID')}</td>
                      <td className="px-5 py-3">
                        <span suppressHydrationWarning className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 text-[10px] font-mono font-bold">
                          {p.status === 'success' || p.status === 'settlement'
                            ? (locale === 'en' ? 'Success' : 'Berhasil')
                            : p.status}
                        </span>
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
