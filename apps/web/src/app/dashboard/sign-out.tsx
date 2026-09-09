'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';
import { useTranslation } from '@/lib/i18n';
import { LogOut } from 'lucide-react';

interface SignOutButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function SignOutButton({ className, children }: SignOutButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      title={t.dashboard.signOut}
      aria-label={t.dashboard.signOut}
      className={
        className ??
        'p-2 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0'
      }
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
      {children ?? <LogOut className="h-4 w-4" />}
    </button>
  );
}
