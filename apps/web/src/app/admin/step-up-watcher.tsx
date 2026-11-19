'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAdminStepUpStatus } from '@/lib/actions';

const CHECK_EVERY_MS = 60_000;
// A tab that stays focused never fires focus/visibility events, so also check on a slow timer.
const POLL_MS = 5 * 60_000;

/**
 * A tab left open past the 24-hour window would only find out on the next save. When the admin
 * comes back to the tab, and every 5 minutes while it is visible, ask the server (read-only, it
 * does not extend the window) and send the tab to the OTP dialog before anything is clicked.
 */
export function StepUpWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const lastCheck = useRef(0);

  useEffect(() => {
    if (pathname.startsWith('/admin/verify')) return;

    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = now;
      try {
        const status = await getAdminStepUpStatus();
        if (status.required) {
          const next = window.location.pathname + window.location.search;
          router.push(`/admin/verify?next=${encodeURIComponent(next)}`);
        }
      } catch {
        // Offline or a cold database: the next focus tries again, and the server guard still holds.
      }
    };

    const poll = setInterval(check, POLL_MS);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [pathname, router]);

  return null;
}
