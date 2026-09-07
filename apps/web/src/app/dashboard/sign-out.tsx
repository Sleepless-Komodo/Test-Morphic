'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';
import { useTranslation } from '@/lib/i18n';

export function SignOutButton() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <button
      className="text-xs text-neutral-400 hover:text-neutral-900 transition-colors mt-0.5 cursor-pointer font-medium"
      onClick={() =>
        signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push('/login');
              router.refresh();
            },
          },
        })
      }
    >
      <span suppressHydrationWarning>{t.dashboard.signOut}</span>
    </button>
  );
}
