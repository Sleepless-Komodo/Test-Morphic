'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { AuthCard } from '@/components/AuthCard';
import { OtpCodeForm } from '@/components/OtpCodeForm';

// Second step of email+password sign-in for accounts with email OTP turned on. Reached
// from /login/email when sign-in answers with `twoFactorRedirect`; the pending sign-in
// lives in Better Auth's signed two-factor cookie, not in this page.
export default function LoginOtpPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <AuthCard backHref="/login/email" backLabel={t.login.backToOtherOptions} title={t.login.otpTitle} description={t.login.otpDesc}>
      <OtpCodeForm
        onVerified={() => {
          router.push('/dashboard');
          router.refresh();
        }}
      />
    </AuthCard>
  );
}
