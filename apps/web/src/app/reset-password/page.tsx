'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, TriangleAlert } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useTranslation } from '@/lib/i18n';
import { AuthCard } from '@/components/AuthCard';

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950';

// Better Auth's emailed link hits /api/auth/reset-password/:token, which redirects here with
// ?token=... when valid or ?error=INVALID_TOKEN when not.
function ResetPasswordForm() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    !token || params.get('error') ? t.login.resetInvalidToken : null,
  );
  const tokenUsable = Boolean(token) && !params.get('error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || saving) return;
    if (password !== confirm) {
      setError(t.login.resetMismatch);
      return;
    }
    setSaving(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setSaving(false);
    if (res.error) {
      setError(res.error.code === 'INVALID_TOKEN' ? t.login.resetInvalidToken : (res.error.message ?? t.login.authGenericError));
      return;
    }
    setDone(true);
  };

  return (
    <AuthCard backHref="/login/email" backLabel={t.login.backToSignIn} title={t.login.resetTitle} description={t.login.resetDesc}>
      {error && (
        <div role="alert" className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-left">
          <TriangleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-amber-800 leading-relaxed">
            {error}{' '}
            {error === t.login.resetInvalidToken && (
              <Link href="/forgot-password" className="underline font-semibold">
                {t.login.resetRequestNew}
              </Link>
            )}
          </p>
        </div>
      )}
      {done ? (
        <div role="status" className="space-y-3 text-left">
          <p className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900">
            {t.login.resetDone}
          </p>
          <Link
            href="/login/email"
            className="w-full min-h-11 py-3 px-5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
          >
            {t.login.signInBtn}
          </Link>
        </div>
      ) : tokenUsable && (
        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          <div>
            <label htmlFor="reset-new" className="text-xs font-bold text-neutral-800 block mb-1.5">
              {t.login.resetNewLabel}
            </label>
            <input id="reset-new" type="password" required minLength={8} maxLength={128} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="reset-confirm" className="text-xs font-bold text-neutral-800 block mb-1.5">
              {t.login.resetConfirmLabel}
            </label>
            <input id="reset-confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-11 py-3 px-5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{t.login.resetBtn}</span>
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
