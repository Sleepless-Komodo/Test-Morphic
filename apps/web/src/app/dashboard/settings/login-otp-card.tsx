'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, MailCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useTranslation } from '@/lib/i18n';
import { OtpCodeForm } from '@/components/OtpCodeForm';

interface LoginOtpCardProps {
  enabled: boolean;
  /** OTP only guards email+password sign-in, so OAuth-only accounts get an explanation instead. */
  hasPassword: boolean;
}

export function LoginOtpCard({ enabled, hasPassword }: LoginOtpCardProps) {
  const { locale } = useTranslation();
  const isId = locale === 'id';
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'enable' | 'disable'>('idle');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMode('idle');
    setPassword('');
    setError(null);
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    const res = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (res.error) {
      setError(
        res.error.code === 'SESSION_NOT_FRESH'
          ? isId
            ? 'Demi keamanan, keluar lalu masuk lagi sebelum mematikan OTP.'
            : 'For security, sign out and back in before turning OTP off.'
          : isId
            ? 'Kata sandi salah.'
            : 'Incorrect password.',
      );
      return;
    }
    reset();
    router.refresh();
  };

  return (
    <div className="p-4 rounded-2xl border border-neutral-200/70 bg-white space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <MailCheck className="h-4 w-4 text-neutral-600 shrink-0" />
            <h3 className="text-xs font-bold text-neutral-900">
              {isId ? 'Kode OTP via email saat login' : 'Email OTP at sign-in'}
            </h3>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                enabled ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {enabled ? (isId ? 'Aktif' : 'On') : isId ? 'Mati' : 'Off'}
            </span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            {hasPassword
              ? isId
                ? 'Setelah memasukkan kata sandi, kami kirim kode 6 digit ke email Anda. Login Google/GitHub tidak diminta kode.'
                : 'After your password, we email you a 6-digit code. Google/GitHub sign-in is not asked for a code.'
              : isId
                ? 'Akun Anda masuk lewat Google/GitHub, jadi keamanan login diatur oleh penyedia itu. OTP email hanya berlaku untuk login email dan kata sandi.'
                : 'You sign in with Google/GitHub, so that provider secures your login. Email OTP only applies to email and password sign-in.'}
          </p>
        </div>

        {hasPassword && mode === 'idle' && (
          <button
            type="button"
            onClick={() => setMode(enabled ? 'disable' : 'enable')}
            className="min-h-11 px-3 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            {enabled ? (isId ? 'Matikan' : 'Turn off') : isId ? 'Aktifkan' : 'Turn on'}
          </button>
        )}
      </div>

      {mode === 'enable' && (
        <div className="pt-3 border-t border-neutral-100 space-y-2">
          <p className="text-xs text-neutral-700">
            {isId
              ? 'Kode sudah dikirim ke email Anda. Masukkan untuk mengaktifkan.'
              : 'We sent a code to your email. Enter it to turn OTP on.'}
          </p>
          <OtpCodeForm
            submitLabel={isId ? 'Aktifkan OTP' : 'Turn on OTP'}
            onVerified={() => {
              reset();
              router.refresh();
            }}
          />
          <button
            type="button"
            onClick={reset}
            className="w-full min-h-11 text-xs font-semibold text-neutral-600 hover:text-neutral-950 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            {isId ? 'Batal' : 'Cancel'}
          </button>
        </div>
      )}

      {mode === 'disable' && (
        <form onSubmit={handleDisable} className="pt-3 border-t border-neutral-100 space-y-2.5">
          <label htmlFor="otp-disable-password" className="text-xs font-bold text-neutral-800 block">
            {isId ? 'Konfirmasi dengan kata sandi' : 'Confirm with your password'}
          </label>
          <input
            id="otp-disable-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950"
          />
          {error && (
            <p role="alert" className="flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-600" />
              <span>{error}</span>
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!password || busy}
              className="min-h-11 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isId ? 'Matikan OTP' : 'Turn off OTP'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              {isId ? 'Batal' : 'Cancel'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
