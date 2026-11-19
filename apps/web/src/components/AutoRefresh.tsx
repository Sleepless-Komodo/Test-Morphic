'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { REFRESH_IDLE_STOP_MS, REFRESH_MS, shouldAutoRefresh } from '@/lib/refresh';

// Re-runs the server component's queries on an interval, politely:
// - only while the tab is visible and the browser is online
// - never while the previous refresh is still rendering (no pile-up on a slow DB)
// - coming back to the tab refreshes once, and only if the data is older than the interval
// - small jitter so many open tabs don't hit the server in lockstep
// - pauses after 30 minutes without input (see REFRESH_IDLE_STOP_MS) and resumes on the next one
export function AutoRefresh({ intervalMs = REFRESH_MS }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  const lastRef = useRef(0);
  const lastInputRef = useRef(0);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    lastRef.current = Date.now(); // the page was just rendered by the server
    lastInputRef.current = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const refreshIfStale = () => {
      const due = shouldAutoRefresh({
        nowMs: Date.now(),
        lastRefreshMs: lastRef.current,
        lastInputMs: lastInputRef.current,
        intervalMs,
      });
      if (!due || pendingRef.current || document.visibilityState !== 'visible' || !navigator.onLine) return;
      lastRef.current = Date.now();
      startTransition(() => router.refresh());
    };
    const schedule = () => {
      timer = setTimeout(() => {
        refreshIfStale();
        schedule();
      }, intervalMs + Math.random() * 0.1 * intervalMs);
    };

    const markInput = () => {
      const wasIdle = Date.now() - lastInputRef.current >= REFRESH_IDLE_STOP_MS;
      lastInputRef.current = Date.now();
      if (wasIdle) refreshIfStale(); // back at the tab: catch up now, not on the next tick
    };
    const inputEvents = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

    schedule();
    for (const name of inputEvents) window.addEventListener(name, markInput, { passive: true });
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('online', refreshIfStale);
    return () => {
      clearTimeout(timer);
      for (const name of inputEvents) window.removeEventListener(name, markInput);
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
    };
  }, [router, intervalMs]);

  return null;
}
