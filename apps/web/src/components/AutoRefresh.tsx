'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

// Re-runs the server component's queries on an interval, politely:
// - only while the tab is visible and the browser is online
// - never while the previous refresh is still rendering (no pile-up on a slow DB)
// - coming back to the tab refreshes once, and only if the data is older than the interval
// - small jitter so many open tabs don't hit the server in lockstep
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  const lastRef = useRef(0);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    lastRef.current = Date.now(); // the page was just rendered by the server
    let timer: ReturnType<typeof setTimeout>;

    const refreshIfStale = () => {
      const stale = Date.now() - lastRef.current >= intervalMs;
      if (!stale || pendingRef.current || document.visibilityState !== 'visible' || !navigator.onLine) return;
      lastRef.current = Date.now();
      startTransition(() => router.refresh());
    };
    const schedule = () => {
      timer = setTimeout(() => {
        refreshIfStale();
        schedule();
      }, intervalMs + Math.random() * 0.1 * intervalMs);
    };

    schedule();
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('online', refreshIfStale);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
    };
  }, [router, intervalMs]);

  return null;
}
