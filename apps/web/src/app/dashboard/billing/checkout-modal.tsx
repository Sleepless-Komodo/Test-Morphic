'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  QrCode,
  Building2,
  Wallet,
  X,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits, cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60; // 3 min max polling

type PaymentStatus = 'idle' | 'creating' | 'waiting' | 'paid' | 'failed' | 'error';
type PaymentCategory = 'all' | 'qris' | 'va' | 'ewallet';

export interface PaymentChannel {
  code: string;
  name: string;
  category: 'qris' | 'va' | 'ewallet';
  badge?: string;
  description: string;
  descriptionEn: string;
}

export const PAYMENT_CHANNELS: PaymentChannel[] = [
  {
    code: 'SP',
    name: 'QRIS (ShopeePay / Universal)',
    category: 'qris',
    badge: 'Rekomendasi',
    description: 'GoPay, OVO, DANA, BCA, Mandiri & Semua Aplikasi Bank',
    descriptionEn: 'GoPay, OVO, DANA, BCA, Mandiri & All Banking Apps',
  },
  {
    code: 'NQ',
    name: 'QRIS (Nobu Bank)',
    category: 'qris',
    description: 'Alternatif QRIS instan bebas biaya admin',
    descriptionEn: 'Instant QRIS alternative zero admin fee',
  },
  {
    code: 'BC',
    name: 'BCA Virtual Account',
    category: 'va',
    description: 'Transfer via BCA Mobile, myBCA, KlikBCA, atau ATM',
    descriptionEn: 'Transfer via BCA Mobile, myBCA, KlikBCA, or ATM',
  },
  {
    code: 'M2',
    name: 'Mandiri Virtual Account',
    category: 'va',
    description: 'Transfer via Livin by Mandiri atau ATM',
    descriptionEn: 'Transfer via Livin by Mandiri or ATM',
  },
  {
    code: 'BN',
    name: 'BNI Virtual Account',
    category: 'va',
    description: 'Transfer via BNI Mobile Banking atau ATM',
    descriptionEn: 'Transfer via BNI Mobile Banking or ATM',
  },
  {
    code: 'BR',
    name: 'BRI Virtual Account (BRIVA)',
    category: 'va',
    description: 'Transfer via BRImo atau ATM BRI',
    descriptionEn: 'Transfer via BRImo or ATM BRI',
  },
  {
    code: 'BT',
    name: 'Permata Virtual Account',
    category: 'va',
    description: 'Transfer via PermataMobile X atau ATM',
    descriptionEn: 'Transfer via PermataMobile X or ATM',
  },
  {
    code: 'OV',
    name: 'OVO',
    category: 'ewallet',
    description: 'Pembayaran langsung via aplikasi OVO',
    descriptionEn: 'Direct payment via OVO app',
  },
  {
    code: 'DA',
    name: 'DANA',
    category: 'ewallet',
    description: 'Pembayaran instan akun DANA',
    descriptionEn: 'Instant payment with DANA account',
  },
  {
    code: 'SA',
    name: 'ShopeePay App',
    category: 'ewallet',
    description: 'Buka langsung aplikasi ShopeePay',
    descriptionEn: 'Direct opening in ShopeePay app',
  },
];

interface CheckoutModalProps {
  pkg: {
    id: string;
    name: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    priceCents: number;
    creditAllowance: number;
    durationHours?: number;
  };
  onClose: () => void;
  onSuccess: (creditsAdded: number) => void;
}

export function CheckoutModal({ pkg, onClose, onSuccess }: CheckoutModalProps) {
  const { t, locale } = useTranslation();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [selectedMethod, setSelectedMethod] = useState<string>('SP');
  const [categoryFilter, setCategoryFilter] = useState<PaymentCategory>('all');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const secs = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
      if (mountedRef.current) setSecondsLeft(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Polling loop
  const startPolling = useCallback((pid: string) => {
    const poll = async () => {
      if (!mountedRef.current) return;
      pollAttemptsRef.current++;
      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        setStatus('error');
        setErrorMsg('Batas waktu polling habis. Cek history pembayaran jika sudah bayar.');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/v1/payments/${pid}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('poll failed');
        const data = await res.json() as { status: string };

        if (!mountedRef.current) return;

        if (data.status === 'paid') {
          setStatus('paid');
          onSuccess(pkg.creditAllowance);
          return; // stop polling
        } else if (data.status === 'failed' || data.status === 'expired') {
          setStatus('failed');
          return;
        }
      } catch {
        // Non-fatal, keep polling
      }

      if (mountedRef.current) {
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [pkg.creditAllowance, onSuccess]);

  const handleCreatePayment = async () => {
    setStatus('creating');
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_URL}/v1/payments/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          paymentMethod: selectedMethod,
        }),
      });

      const data = await res.json() as {
        paymentId?: string;
        paymentUrl?: string;
        expiresAt?: string;
        error?: { message: string };
      };

      if (!res.ok || !data.paymentUrl || !data.paymentId) {
        throw new Error(data.error?.message ?? 'Gagal membuat transaksi');
      }

      setPaymentId(data.paymentId);
      setPaymentUrl(data.paymentUrl);
      setExpiresAt(new Date(data.expiresAt!));
      setStatus('waiting');
      pollAttemptsRef.current = 0;

      // Open Duitku payment page in new tab
      window.open(data.paymentUrl, '_blank', 'noopener,noreferrer');

      startPolling(data.paymentId);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? 'Terjadi kesalahan, coba lagi.');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'creating') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, status]);

  const pkgName = locale === 'en' && pkg.nameEn ? pkg.nameEn : pkg.name;
  const selectedChannel = PAYMENT_CHANNELS.find((c) => c.code === selectedMethod) ?? PAYMENT_CHANNELS[0];

  const filteredChannels = categoryFilter === 'all'
    ? PAYMENT_CHANNELS
    : PAYMENT_CHANNELS.filter((c) => c.category === categoryFilter);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'creating') {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-in fade-in"
    >
      <div
        className="bg-white rounded-2xl border border-neutral-200 max-w-md w-full max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Checkout: ${pkgName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
          <h3 className="text-sm font-semibold text-neutral-900 font-heading">
            {locale === 'en' ? 'Checkout via Duitku' : 'Checkout via Duitku'}
          </h3>
          <button
            id="checkout-modal-close"
            onClick={onClose}
            aria-label={locale === 'en' ? 'Close modal' : 'Tutup modal'}
            className="text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Package Info Card */}
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-base font-bold text-neutral-950 font-heading leading-tight">{pkgName}</div>
                <div className="text-xs text-neutral-500 mt-1 font-mono">
                  +{formatCredits(pkg.creditAllowance)} credits
                  {pkg.durationHours ? ` · ${pkg.durationHours >= 24 ? `${pkg.durationHours / 24} hari` : `${pkg.durationHours} jam`}` : ''}
                </div>
              </div>
              <div className="text-xl font-black text-neutral-950 font-mono shrink-0">
                Rp {pkg.priceCents.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Payment Method Selector (Only visible during idle state) */}
          {status === 'idle' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-800">
                  {t.dashboard.selectPaymentMethod}
                </span>
                <span className="text-[11px] text-neutral-500 font-medium">
                  {selectedChannel.name.split(' ')[0]}
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl">
                {[
                  { id: 'all', label: t.dashboard.allPaymentMethods },
                  { id: 'qris', label: t.dashboard.qrisCategory },
                  { id: 'va', label: t.dashboard.vaCategory },
                  { id: 'ewallet', label: t.dashboard.ewalletCategory },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id as PaymentCategory)}
                    className={cn(
                      'flex-1 py-1 px-1.5 text-[11px] font-medium rounded-lg transition-all cursor-pointer text-center truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950',
                      categoryFilter === tab.id
                        ? 'bg-white text-neutral-950 shadow-2xs font-semibold'
                        : 'text-neutral-500 hover:text-neutral-900'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Channel list */}
              <div
                className="space-y-1.5 max-h-56 overflow-y-auto pr-1"
                role="radiogroup"
                aria-label={t.dashboard.selectPaymentMethod}
              >
                {filteredChannels.map((channel) => {
                  const isSelected = selectedMethod === channel.code;
                  return (
                    <label
                      key={channel.code}
                      htmlFor={`channel-${channel.code}`}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer text-left select-none focus-within:ring-2 focus-within:ring-neutral-950',
                        isSelected
                          ? 'border-neutral-950 bg-neutral-50/90 ring-1 ring-neutral-950 shadow-2xs'
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/40 bg-white'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'p-2 rounded-lg shrink-0 transition-colors',
                            isSelected ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-700'
                          )}
                        >
                          {channel.category === 'qris' ? (
                            <QrCode className="h-4 w-4" />
                          ) : channel.category === 'va' ? (
                            <Building2 className="h-4 w-4" />
                          ) : (
                            <Wallet className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-950 truncate">
                              {channel.name}
                            </span>
                            {channel.badge && (
                              <span className="text-[11px] font-medium text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md shrink-0">
                                {channel.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                            {locale === 'en' ? channel.descriptionEn : channel.description}
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-2 transition-colors',
                          isSelected ? 'border-neutral-950 bg-neutral-950' : 'border-neutral-300 bg-white'
                        )}
                        aria-hidden="true"
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <input
                        type="radio"
                        id={`channel-${channel.code}`}
                        name="paymentMethod"
                        value={channel.code}
                        checked={isSelected}
                        onChange={() => setSelectedMethod(channel.code)}
                        className="sr-only"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Creating State */}
          {status === 'creating' && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-neutral-600">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-900" />
              <span>{locale === 'en' ? 'Creating transaction…' : 'Membuat transaksi…'}</span>
            </div>
          )}

          {/* Waiting State */}
          {status === 'waiting' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-center space-y-2.5">
                <div className="flex items-center justify-center gap-2 text-neutral-900 text-sm font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-800" />
                  <span>{locale === 'en' ? 'Waiting for payment…' : 'Menunggu pembayaran…'}</span>
                </div>
                <div className="text-xs text-neutral-700 font-medium">
                  {locale === 'en' ? 'Method: ' : 'Metode: '}
                  <span className="font-bold text-neutral-950">{selectedChannel.name}</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {locale === 'en'
                    ? 'Complete payment in the Duitku tab. This page will update automatically.'
                    : 'Selesaikan pembayaran di tab Duitku. Halaman ini akan otomatis terupdate.'}
                </p>
                {secondsLeft !== null && secondsLeft > 0 && (
                  <div className="flex items-center justify-center gap-1 text-xs text-neutral-500 font-mono font-bold">
                    <Clock className="h-3.5 w-3.5 text-neutral-500" />
                    <span>{formatCountdown(secondsLeft)}</span>
                  </div>
                )}
              </div>
              {paymentUrl && (
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 transition-colors py-1 font-medium"
                >
                  <ExternalLink className="h-3 w-3" />
                  {locale === 'en' ? 'Reopen payment page' : 'Buka ulang halaman pembayaran'}
                </a>
              )}
            </div>
          )}

          {/* Paid State */}
          {status === 'paid' && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center space-y-1.5">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <div className="font-bold text-emerald-900 text-sm">
                {locale === 'en' ? 'Payment successful!' : 'Pembayaran berhasil!'}
              </div>
              <div className="text-xs text-emerald-700">
                +{formatCredits(pkg.creditAllowance)} {locale === 'en' ? 'credits added' : 'kredit ditambahkan'}
              </div>
            </div>
          )}

          {/* Failed State */}
          {status === 'failed' && (
            <div className="p-5 rounded-xl bg-red-50 border border-red-100 text-center space-y-1.5">
              <XCircle className="h-8 w-8 text-red-500 mx-auto" />
              <div className="font-bold text-red-900 text-sm">
                {locale === 'en' ? 'Payment failed or expired.' : 'Pembayaran gagal atau kedaluwarsa.'}
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 text-center">
              {errorMsg ?? (locale === 'en' ? 'An error occurred.' : 'Terjadi kesalahan.')}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 pb-6 pt-2 border-t border-neutral-100 shrink-0 space-y-2">
          {(status === 'idle' || status === 'error') && (
            <button
              id="checkout-pay-btn"
              onClick={handleCreatePayment}
              className="w-full py-3 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 active:scale-[0.99] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              <span>{t.dashboard.payWithSelectedMethod}</span>
              <span className="text-neutral-400 font-normal">•</span>
              <span className="font-mono tabular-nums">Rp {pkg.priceCents.toLocaleString('id-ID')}</span>
            </button>
          )}

          {status === 'waiting' && (
            <button
              id="checkout-check-btn"
              onClick={() => {
                if (paymentId) {
                  pollAttemptsRef.current = Math.max(0, pollAttemptsRef.current - 5);
                }
              }}
              className="w-full py-2.5 rounded-xl border border-neutral-200 hover:border-neutral-300 text-neutral-700 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {locale === 'en' ? 'I have paid, check again' : 'Sudah bayar, cek sekarang'}
            </button>
          )}

          {(status === 'paid' || status === 'failed') && (
            <button
              id="checkout-close-btn"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              {locale === 'en' ? 'Close' : 'Tutup'}
            </button>
          )}

          {status !== 'idle' && status !== 'paid' && status !== 'failed' && (
            <button
              id="checkout-cancel-btn"
              onClick={onClose}
              className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              {locale === 'en' ? 'Cancel' : 'Batal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
