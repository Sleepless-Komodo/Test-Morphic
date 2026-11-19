'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestAdminStepUpCode, verifyAdminStepUpCode } from '@/lib/actions';
import { useTranslation } from '@/lib/i18n';

/**
 * Email OTP gate shown over the admin shell when the session has been away from the panel for
 * 24 hours or arrives from another country. The panel stays locked until the code is accepted;
 * Escape and the secondary button leave for the regular dashboard instead.
 */
export function StepUpDialog({ email, next }: { email: string | null; next: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const copy = t.admin.stepUp;
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    sendRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/dashboard');
        return;
      }
      // Keep Tab inside the dialog: the panel behind it is locked until the code is accepted.
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const sendCode = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await requestAdminStepUpCode();
        if (!res.ok && res.reason !== 'cooldown') {
          setError(res.error);
          return;
        }
        // A cooldown means the last code is still in the inbox: show the input and count down.
        setCodeSent(true);
        setCooldown(res.retryAfterS);
        setInfo(res.ok ? copy.sent : copy.stillValid);
        requestAnimationFrame(() => codeRef.current?.focus());
      } catch {
        setError(copy.failed);
      }
    });
  };

  const verify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.length !== 6 || isPending) return;
    setError(null);
    setInfo(null);
    const fd = new FormData();
    fd.set('code', code);
    startTransition(async () => {
      try {
        const res = await verifyAdminStepUpCode(fd);
        if (!res.ok) {
          setError(res.error);
          codeRef.current?.focus();
          return;
        }
        router.replace(next);
        router.refresh();
      } catch {
        setError(copy.failed);
      }
    });
  };

  const body = copy.body.replace('{email}', email ?? 'email admin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-neutral-950/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-md space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <div className="space-y-2">
          <h2 id={titleId} className="font-heading text-lg font-bold tracking-tight text-neutral-950">
            {copy.title}
          </h2>
          <p id={bodyId} className="text-sm leading-relaxed text-neutral-600">
            {body}
          </p>
        </div>

        {codeSent ? (
          <form onSubmit={verify} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-neutral-700">{copy.codeLabel}</span>
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="w-full rounded-xl border border-neutral-500 bg-white px-3 py-2.5 font-mono text-lg tracking-[0.4em] text-neutral-950 focus-visible:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              />
            </label>
            <button
              type="submit"
              disabled={isPending || code.length !== 6}
              className="min-h-11 w-full rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-500"
            >
              {isPending ? copy.verifying : copy.verify}
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={isPending || cooldown > 0}
              className="min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
            >
              {cooldown > 0 ? copy.resendIn.replace('{seconds}', String(cooldown)) : copy.resend}
            </button>
          </form>
        ) : (
          <button
            ref={sendRef}
            type="button"
            onClick={sendCode}
            disabled={isPending}
            className="min-h-11 w-full rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            {isPending ? copy.sending : copy.sendCode}
          </button>
        )}

        <p aria-live="polite" className="min-h-5 text-sm">
          {error ? (
            <span className="font-medium text-red-700">{error}</span>
          ) : info ? (
            <span className="text-neutral-700">{info}</span>
          ) : null}
        </p>

        <div className="border-t border-neutral-200 pt-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="min-h-11 rounded-lg px-1 text-sm font-semibold text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            {t.admin.backToDashboard}
          </button>
        </div>
      </div>
    </div>
  );
}
