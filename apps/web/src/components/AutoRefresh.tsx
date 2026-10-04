'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Re-runs the server component's DB queries on an interval; skips while the tab is hidden.
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router, intervalMs]);
  return null;
}
