'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useTranslation } from '@/lib/i18n';

const RESEND_COOLDOWN_S = 60;

interface OtpCodeFormProps {
  /** Called after the code is accepted. Sign-in: session is set. Settings: OTP is now on. */
  onVerified: () => void;
  /** Sign-in step expired (no 2FA cookie). Only reachable from the login page. */
  onSessionLost?: () => void;
  submitLabel?: string;
}

/**
 * Email OTP entry shared by the sign-in step and the Settings enable flow. Both use the
 * same Better Auth endpoints: send-otp mails a code, verify-otp checks it (and, for a
 * signed-in user who has OTP off, turns it on).
 */
export function OtpCodeForm({ onVerified, onSessionLost, submitLabel }: OtpCodeFormProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sentOnce = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = useCallback(async () => {
    setError(null);
    setCooldown(RESEND_COOLDOWN_S);
    const res = await authClient.twoFactor.sendOtp();
    if (res.error) {
      setCooldown(0);
      if (res.error.code === 'INVALID_TWO_FACTOR_COOKIE') {
        setError(t.login.otpSessionLost);
        onSessionLost?.();
      } else {
        setError(t.login.otpSendFailed);
      }
      return false;
    }
    return true;
  }, [t, onSessionLost]);

  useEffect(() => {
    // Strict mode runs effects twice in dev; one email per mount is enough.
    if (sentOnce.current) return;
    sentOnce.current = true;
    send();
    inputRef.current?.focus();
  }, [send]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleResend = async () => {
    setNotice(null);
    if (await send()) setNotice(t.login.otpSent);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    setNotice(null);
    const res = await authClient.twoFactor.verifyOtp({ code });
    setVerifying(false);
    if (!res.error) {
      onVerified();
      return;
    }
    const map: Record<string, string> = {
      INVALID_CODE: t.login.otpInvalid,
      OTP_HAS_EXPIRED: t.login.otpExpired,
      TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: t.login.otpTooMany,
      INVALID_TWO_FACTOR_COOKIE: t.login.otpSessionLost,
    };
    setError(map[res.error.code ?? ''] ?? t.login.authGenericError);
    if (res.error.code === 'INVALID_TWO_FACTOR_COOKIE') onSessionLost?.();
    setCode('');
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
      {error && (
        <div role="alert" className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <TriangleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-amber-800 leading-relaxed">{error}</p>
        </div>
      )}
      {notice && !error && (
        <p role="status" className="text-xs text-neutral-700">
          {notice}
        </p>
      )}

      <div>
        <label htmlFor="otp-code" className="text-xs font-bold text-neutral-800 block mb-1.5">
          {t.login.otpLabel}
        </label>
        <input
          ref={inputRef}
          id="otp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          placeholder="000000"
          className="w-full px-3.5 py-3 rounded-xl border border-neutral-300 text-lg tracking-[0.5em] text-center font-mono text-neutral-900 bg-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950"
        />
      </div>

      <button
        type="submit"
        disabled={code.length !== 6 || verifying}
        className="w-full min-h-11 py-3 px-5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
      >
        {verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span>{submitLabel ?? t.login.otpVerifyBtn}</span>
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0}
        className="w-full min-h-11 text-xs font-semibold text-neutral-700 hover:text-neutral-950 disabled:text-neutral-500 disabled:cursor-not-allowed cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
      >
        {cooldown > 0 ? t.login.otpResendIn.replace('{s}', String(cooldown)) : t.login.otpResend}
      </button>
    </form>
  );
}
