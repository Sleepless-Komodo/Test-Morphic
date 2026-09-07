'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from '@/lib/auth-client';
import { useTranslation } from '@/lib/i18n';
import { ArrowLeft, Loader2, KeyRound, LayoutDashboard, LogOut, CheckCircle2, Globe } from 'lucide-react';

export default function Login() {
  const { t, locale, setLocale } = useTranslation();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [keyLoading, setKeyLoading] = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      setLoadingProvider(provider);
      await signIn.social({
        provider,
        callbackURL: '/dashboard',
      });
    } catch (err) {
      console.error('Sign-in error:', err);
      setLoadingProvider(null);
    }
  };

  const handleKeySignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setKeyError(locale === 'id' ? 'Masukkan API key Anda' : 'Please enter your API key');
      return;
    }
    if (!trimmed.startsWith('mp-')) {
      setKeyError(
        locale === 'id'
          ? 'Format API key tidak valid (harus diawali mp-)'
          : 'Invalid key format (must start with mp-)'
      );
      return;
    }

    setKeyLoading(true);
    setKeyError('');
    // Store API key locally for quick-fill/session use & redirect to dashboard
    try {
      localStorage.setItem('morphic_active_key', trimmed);
      router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between bg-[#fafafa] text-neutral-900 px-4 sm:px-6 py-8 sm:py-10 selection:bg-neutral-900 selection:text-white relative overflow-hidden">
      {/* Subtle Ambient Glow Behind Card (Eliminates flat/AI-box feel) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-gradient-to-br from-neutral-200/60 via-neutral-100/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top bar: Back to Home + Language Switcher */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-neutral-950 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.login.backHome}</span>
        </Link>

        {/* Language Switcher: Segmented ID | EN */}
        <div className="inline-flex items-center p-0.5 rounded-full border border-neutral-200 bg-neutral-100 text-[11px] font-mono select-none">
          <button
            type="button"
            onClick={() => setLocale('id')}
            className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
              locale === 'id'
                ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                : 'text-neutral-500 hover:text-neutral-900 font-medium'
            }`}
          >
            ID
          </button>
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
              locale === 'en'
                ? 'bg-white text-neutral-950 shadow-2xs font-bold'
                : 'text-neutral-500 hover:text-neutral-900 font-medium'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Center Auth Container */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white/95 backdrop-blur-xl border border-neutral-300/80 rounded-3xl p-7 sm:p-9 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.08)] ring-1 ring-neutral-900/5 text-center relative overflow-hidden">
          {/* Top Brand Glyph */}
          <div className="w-11 h-11 rounded-2xl bg-neutral-950 text-white flex items-center justify-center mx-auto mb-5 shadow-xs">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="12" r="5" />
              <path d="M12 12h5a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4h-5" />
              <path d="M12 7v5" />
            </svg>
          </div>

          {/* Conditional View: When Already Logged In */}
          {session?.user ? (
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active Session</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-neutral-950 tracking-tight mb-1">
                {t.login.alreadyLoggedIn}
              </h1>
              <p className="text-sm font-bold text-neutral-900 mb-1">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs text-neutral-500 mb-6">
                {session.user.email}
              </p>

              <div className="space-y-3">
                <Link
                  href="/dashboard"
                  className="w-full py-3 px-5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>{t.login.goToDashboard}</span>
                </Link>

                <button
                  onClick={async () => {
                    await signOut();
                    window.location.reload();
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl border border-neutral-200 hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{t.login.switchAccount}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Normal Sign-in View */
            <div>
              <h1 className="text-2xl font-heading font-extrabold text-neutral-950 tracking-tight mb-2">
                {t.login.title}
              </h1>
              <p className="text-neutral-600 font-body text-xs sm:text-sm mb-7 leading-relaxed">
                {t.login.subtitle}
              </p>

              {!showKeyInput ? (
                <div className="space-y-3">
                  {/* Google Sign In Button */}
                  <button
                    disabled={loadingProvider !== null || isPending}
                    onClick={() => handleSocialLogin('google')}
                    className="w-full py-3 px-5 rounded-2xl border border-neutral-300 bg-white hover:bg-neutral-50 hover:border-neutral-400 text-neutral-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingProvider === 'google' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-neutral-600" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27a7.22 7.22 0 0 1 0-4.54V6.58H1.25a11.98 11.98 0 0 0 0 10.84l4.03-3.15Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                        />
                      </svg>
                    )}
                    <span>{t.login.googleBtn}</span>
                  </button>

                  {/* GitHub Sign In Button */}
                  <button
                    disabled={loadingProvider !== null || isPending}
                    onClick={() => handleSocialLogin('github')}
                    className="w-full py-3 px-5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingProvider === 'github' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        />
                      </svg>
                    )}
                    <span>{t.login.githubBtn}</span>
                  </button>

                  {/* Divider */}
                  <div className="relative my-4 flex items-center justify-center">
                    <div className="border-t border-neutral-200 w-full" />
                    <span className="bg-white px-3 text-[11px] font-semibold text-neutral-400 uppercase">
                      or
                    </span>
                  </div>

                  {/* Enter with API Key Button */}
                  <button
                    onClick={() => setShowKeyInput(true)}
                    className="w-full py-3 px-4 rounded-2xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-300 text-neutral-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs group"
                  >
                    <KeyRound className="h-4 w-4 text-neutral-600 transition-transform group-hover:rotate-12" />
                    <span>{t.login.keyOption}</span>
                  </button>
                </div>
              ) : (
                /* Key Input Mode */
                <form onSubmit={handleKeySignIn} className="space-y-3 text-left">
                  <div>
                    <label className="text-xs font-bold text-neutral-800 block mb-1.5">
                      {t.login.keyTitle}
                    </label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setKeyError('');
                      }}
                      placeholder={t.login.keyPlaceholder}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-mono text-neutral-900 bg-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950 transition-all"
                    />
                    {keyError && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{keyError}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={keyLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {keyLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{t.login.keySubmit}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowKeyInput(false)}
                    className="w-full py-2 text-center text-xs text-neutral-500 hover:text-neutral-800 font-medium cursor-pointer"
                  >
                    {t.login.keyCancel}
                  </button>
                </form>
              )}

              {/* Bottom terms */}
              <div className="mt-8 pt-6 border-t border-neutral-100 text-[11px] text-neutral-400 leading-relaxed">
                {t.login.termsNotice}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-neutral-400 text-xs">
        &copy; 2026 Morphic. All rights reserved.
      </div>
    </main>
  );
}
