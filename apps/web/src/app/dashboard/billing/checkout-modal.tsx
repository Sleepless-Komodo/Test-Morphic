'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60; // 3 min max polling

type PaymentStatus = 'idle' | 'creating' | 'waiting' | 'paid' | 'failed' | 'error';

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
        body: JSON.stringify({ packageId: pkg.id }),
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
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const pkgName = locale === 'en' && pkg.nameEn ? pkg.nameEn : pkg.name;

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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
    >
      <div
        className="bg-white rounded-3xl border border-neutral-200 max-w-sm w-full shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Checkout: ${pkgName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <span className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest">
            {locale === 'en' ? 'Checkout via Duitku' : 'Checkout via Duitku'}
          </span>
          <button
            id="checkout-modal-close"
            onClick={onClose}
            aria-label="Close modal"
            className="text-neutral-500 hover:text-neutral-900 transition-colors text-lg cursor-pointer p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Package info */}
          <div className="text-center">
            <div className="text-lg font-extrabold text-neutral-950 font-heading">{pkgName}</div>
            <div className="text-3xl font-black text-neutral-950 mt-1 font-mono">
              Rp {(pkg.priceCents).toLocaleString('id-ID')}
            </div>
            <div className="text-xs text-neutral-500 mt-1 font-mono">
              +{formatCredits(pkg.creditAllowance)} credits
              {pkg.durationHours ? ` · ${pkg.durationHours >= 24 ? `${pkg.durationHours / 24} hari` : `${pkg.durationHours} jam`}` : ''}
            </div>
          </div>

          {/* Status area */}
          {status === 'idle' && (
            <div className="text-center text-sm text-neutral-500 leading-relaxed">
              {locale === 'en'
                ? 'Click below to open the Duitku payment page (QRIS, VA, e-wallet, etc.)'
                : 'Klik di bawah untuk membuka halaman pembayaran Duitku (QRIS, VA, e-wallet, dll.)'}
            </div>
          )}

          {status === 'creating' && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{locale === 'en' ? 'Creating transaction…' : 'Membuat transaksi…'}</span>
            </div>
          )}

          {status === 'waiting' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-neutral-900 text-sm font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-800" />
                  <span>{locale === 'en' ? 'Waiting for payment…' : 'Menunggu pembayaran…'}</span>
                </div>
                <p className="text-xs text-neutral-600">
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
                  className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {locale === 'en' ? 'Reopen payment page' : 'Buka ulang halaman pembayaran'}
                </a>
              )}
            </div>
          )}

          {status === 'paid' && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center space-y-1">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <div className="font-bold text-emerald-800 text-sm">
                {locale === 'en' ? 'Payment successful!' : 'Pembayaran berhasil!'}
              </div>
              <div className="text-xs text-emerald-600">
                +{formatCredits(pkg.creditAllowance)} {locale === 'en' ? 'credits added' : 'kredit ditambahkan'}
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-center space-y-1">
              <XCircle className="h-8 w-8 text-red-400 mx-auto" />
              <div className="font-bold text-red-800 text-sm">
                {locale === 'en' ? 'Payment failed or expired.' : 'Pembayaran gagal atau kedaluwarsa.'}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 text-center">
              {errorMsg ?? (locale === 'en' ? 'An error occurred.' : 'Terjadi kesalahan.')}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 space-y-2">
          {(status === 'idle' || status === 'error') && (
            <button
              id="checkout-pay-btn"
              onClick={handleCreatePayment}
              className="w-full py-3 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {locale === 'en' ? 'Pay with Duitku' : 'Bayar dengan Duitku'}
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
              className="w-full py-2.5 rounded-2xl border border-neutral-200 hover:border-neutral-300 text-neutral-700 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {locale === 'en' ? 'I have paid, check again' : 'Sudah bayar, cek sekarang'}
            </button>
          )}

          {(status === 'paid' || status === 'failed') && (
            <button
              id="checkout-close-btn"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-bold transition-all cursor-pointer"
            >
              {locale === 'en' ? 'Close' : 'Tutup'}
            </button>
          )}

          {status !== 'idle' && status !== 'paid' && status !== 'failed' && (
            <button
              id="checkout-cancel-btn"
              onClick={onClose}
              className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              {locale === 'en' ? 'Cancel' : 'Batal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
