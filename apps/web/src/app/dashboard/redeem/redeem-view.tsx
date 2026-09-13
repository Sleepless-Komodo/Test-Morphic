'use client';

import { useState } from 'react';
import { Gift, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatCredits } from '@/lib/utils';
import { redeemCodeDirect } from '@/lib/actions';

export function RedeemView() {
  const { t, locale } = useTranslation();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reward, setReward] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setStatus('loading');
    setErrorMsg(null);
    setReward(null);

    try {
      // Execute Server Action directly (no CORS or cookie-stripping issues)
      const res = await redeemCodeDirect(code);

      if (!res.ok) {
        throw new Error(res.message || (locale === 'en' ? 'Failed to redeem code' : 'Gagal menukarkan kode'));
      }

      setStatus('success');
      setReward(res.reward || { type: 'credits', credits: 0 });
      setCode('');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-4">
          <Gift className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-neutral-900 tracking-tight">
          {locale === 'en' ? 'Redeem Code' : 'Tukar Kode Redeem'}
        </h1>
        <p className="mt-3 text-neutral-500 text-sm max-w-sm mx-auto">
          {locale === 'en' 
            ? 'Enter your gift code below to claim credits or package entitlements.'
            : 'Masukkan kode hadiah kamu di bawah ini untuk klaim kredit atau paket.'}
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-semibold text-neutral-900 mb-2">
              {locale === 'en' ? 'Gift Code' : 'Kode Hadiah'}
            </label>
            <input
              type="text"
              id="code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={locale === 'en' ? 'e.g., WELCOME2024' : 'Cth: WELCOME2024'}
              className="w-full px-4 py-3 rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-900 text-lg font-mono font-bold placeholder:font-sans placeholder:font-normal placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase"
              disabled={status === 'loading'}
            />
          </div>

          <button
            type="submit"
            disabled={!code.trim() || status === 'loading'}
            className="w-full py-3.5 px-4 rounded-2xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === 'loading' 
              ? (locale === 'en' ? 'Redeeming...' : 'Menukarkan...') 
              : (locale === 'en' ? 'Redeem Now' : 'Tukar Sekarang')}
          </button>
        </form>

        {/* Status Messages */}
        {status === 'error' && (
          <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-800">
                {locale === 'en' ? 'Redemption Failed' : 'Gagal Menukarkan'}
              </h3>
              <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {status === 'success' && reward && (
          <div className="mt-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-4 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-1" />
            <div>
              <h3 className="text-base font-bold text-emerald-800">
                {locale === 'en' ? 'Successfully Redeemed!' : 'Berhasil Ditukarkan!'}
              </h3>
              <p className="text-sm text-emerald-700 mt-1">
                {reward.type === 'credits' 
                  ? (locale === 'en' 
                      ? `You received ${formatCredits(reward.credits)} credits.` 
                      : `Kamu mendapatkan tambahan ${formatCredits(reward.credits)} kredit.`)
                  : (locale === 'en'
                      ? `You received the package: ${reward.package?.name}`
                      : `Kamu mendapatkan paket: ${reward.package?.name}`)
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
