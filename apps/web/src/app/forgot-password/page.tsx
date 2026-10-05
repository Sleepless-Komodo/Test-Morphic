'use client';

import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useTranslation } from '@/lib/i18n';
import { AuthCard } from '@/components/AuthCard';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    // The answer is the same whether or not the address has an account, so the form
    // never reveals which emails are registered.
    await authClient.requestPasswordReset({ email: email.trim(), redirectTo: '/reset-password' });
    setSending(false);
    setSent(true);
  };

  return (
    <AuthCard backHref="/login/email" backLabel={t.login.backToSignIn} title={t.login.forgotTitle} description={t.login.forgotDesc}>
      {sent ? (
        <p role="status" className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 text-left leading-relaxed">
          {t.login.forgotSent}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          <div>
            <label htmlFor="forgot-email" className="text-xs font-bold text-neutral-800 block mb-1.5">
              {t.login.emailLabel}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.login.emailPlaceholder}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-950"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full min-h-11 py-3 px-5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
          >
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{t.login.forgotBtn}</span>
          </button>
        </form>
      )}
    </AuthCard>
  );
}
