'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { OtpCodeForm } from '@/components/OtpCodeForm';

// Second step of email+password sign-in for accounts with email OTP turned on. Reached
// from /login/email when sign-in answers with `twoFactorRedirect`; the pending sign-in
// lives in Better Auth's signed two-factor cookie, not in this page.
export default function LoginOtpPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col justify-between bg-[#fafafa] text-neutral-900 px-4 sm:px-6 py-8 sm:py-10">
      <div className="max-w-md w-full mx-auto">
        <Link
          href="/login/email"
          className="inline-flex items-center gap-2 min-h-11 text-xs font-semibold text-neutral-600 hover:text-neutral-950 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span suppressHydrationWarning>{t.login.backToOtherOptions}</span>
        </Link>
      </div>

      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white border border-neutral-300/80 rounded-3xl p-7 sm:p-9 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.08)] ring-1 ring-neutral-900/5 text-center">
          <div className="flex justify-center mb-5">
            <Link href="/" className="inline-block">
              <Image
                src="/morphic-symbol.jpg"
                alt="Morphic logo"
                width={44}
                height={44}
                priority
                className="w-11 h-11 rounded-2xl object-cover ring-1 ring-neutral-200"
              />
            </Link>
          </div>
          <h1 suppressHydrationWarning className="text-2xl font-heading font-extrabold text-neutral-950 tracking-tight mb-2">
            {t.login.otpTitle}
          </h1>
          <p suppressHydrationWarning className="text-neutral-600 text-xs sm:text-sm mb-6 leading-relaxed">
            {t.login.otpDesc}
          </p>
          <OtpCodeForm
            onVerified={() => {
              router.push('/dashboard');
              router.refresh();
            }}
          />
        </div>
      </div>

      <div className="text-center text-neutral-500 text-xs">&copy; 2026 Morphic. All rights reserved.</div>
    </main>
  );
}
