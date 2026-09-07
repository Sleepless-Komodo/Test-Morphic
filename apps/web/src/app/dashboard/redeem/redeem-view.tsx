'use client';

import { useState, useTransition } from 'react';
import { useTranslation } from '@/lib/i18n';
import { redeemCode } from '@/lib/actions';
import { Ticket, CheckCircle2, AlertCircle, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

export function RedeemView() {
  const { t, locale } = useTranslation();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set('code', code.trim());
      const res = await redeemCode({ ok: false, message: '' }, fd);
      setStatus(res);
      if (res.ok) {
        setCode('');
      }
    });
  };

  const handleQuickCode = (sampleCode: string) => {
    setCode(sampleCode);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200/70 pb-4">
        <div suppressHydrationWarning className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold mb-1">
          {locale === 'en' ? 'Morphic Developer Console / Voucher' : 'Konsol Pengembang Morphic / Kupon'}
        </div>
        <h1 suppressHydrationWarning className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
          {t.dashboard.redeemPageTitle}
        </h1>
        <p suppressHydrationWarning className="text-xs md:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
          {t.dashboard.redeemPageSubtitle}
        </p>
      </div>

      {/* 2-Column Balanced Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form (Span 7) */}
        <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white border border-neutral-200/90 shadow-2xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-950">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-neutral-950">
                {t.dashboard.voucherCardTitle}
              </h2>
              <p className="text-xs text-neutral-500">{t.dashboard.voucherCardDesc}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold block mb-2">
                {t.dashboard.voucherInputLabel}
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t.dashboard.voucherInputPlaceholder}
                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-mono font-bold tracking-wider text-neutral-950 focus:outline-none focus:border-black transition-colors"
                />
                <button
                  type="submit"
                  disabled={isPending || !code.trim()}
                  className="px-6 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isPending ? t.dashboard.redeemingBtn : t.dashboard.redeemSubmitBtn}</span>
                </button>
              </div>
            </div>

            {/* Status alerts */}
            {status && (
              <div
                className={`p-4 rounded-2xl border text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
                  status.ok
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50/50 border-red-200 text-red-900'
                }`}
              >
                {status.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <span>{status.message}</span>
              </div>
            )}
          </form>

          {/* Quick try sample voucher chips */}
          <div className="pt-4 border-t border-neutral-100">
            <div className="text-[11px] font-mono text-neutral-400 mb-2">
              {locale === 'en' ? 'Quick test promo codes:' : 'Kode promo uji coba cepat:'}
            </div>
            <div className="flex flex-wrap gap-2">
              {['MIRACLE-HACK', 'DEV-TEST-5K', 'MORPHIC-START'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => handleQuickCode(sample)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-[11px] font-mono text-neutral-700 font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>{sample}</span>
                  <ArrowRight className="h-3 w-3 text-neutral-400" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Terms & Info Card (Span 5) */}
        <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl bg-neutral-950 text-white border border-neutral-800 shadow-md space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="font-heading font-bold text-sm text-white">{t.dashboard.termsCardTitle}</h3>
          </div>

          <ul className="space-y-3 text-xs text-neutral-400 leading-relaxed">
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>{t.dashboard.termItem1}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>{t.dashboard.termItem2}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>{t.dashboard.termItem3}</span>
            </li>
          </ul>

          <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-300 space-y-1">
            <div className="font-bold text-white mb-1">
              {locale === 'en' ? 'Need custom developer credits?' : 'Butuh kuota kredit tim / perusahaan?'}
            </div>
            <div className="text-neutral-400">
              {locale === 'en'
                ? 'Contact support@morphic.sh for enterprise rate limits and bulk invoicing.'
                : 'Hubungi support@morphic.sh untuk kebutuhan rate limit khusus dan faktur pajak.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
