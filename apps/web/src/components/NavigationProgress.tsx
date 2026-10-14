'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevUrlRef = useRef<string>('');

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
  }, []);

  const start = useCallback(() => {
    cleanup();
    setActive(true);
    setProgress(15);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 85;
        }
        const diff = (85 - prev) * 0.12;
        return prev + Math.max(diff, 1.5);
      });
    }, 120);
  }, [cleanup]);

  const complete = useCallback(() => {
    cleanup();
    setProgress(100);
    completeTimerRef.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 280);
  }, [cleanup]);

  // Complete progress whenever the pathname or search parameters change
  useEffect(() => {
    const currentUrl = `${pathname}?${searchParams.toString()}`;
    if (prevUrlRef.current && prevUrlRef.current !== currentUrl) {
      complete();
    }
    prevUrlRef.current = currentUrl;
  }, [pathname, searchParams, complete]);

  // Global click interception for internal Link navigation
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      // Ignore modified clicks (new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;

      const target = (e.target as HTMLElement)?.closest('a');
      if (!target || !target.href) return;

      // Ignore download, external, or target="_blank"
      if (target.target && target.target !== '_self') return;
      if (target.hasAttribute('download')) return;

      const url = new URL(target.href, window.location.href);

      // Check if same origin
      if (url.origin !== window.location.origin) return;

      // Ignore hash-only navigation on the same page
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        if (url.hash) return;
      }

      start();
    };

    const handlePopState = () => {
      start();
    };

    document.addEventListener('click', handleAnchorClick, { capture: true });
    window.addEventListener('popstate', handlePopState);

    return () => {
      cleanup();
      document.removeEventListener('click', handleAnchorClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
    };
  }, [start, cleanup]);

  if (!active && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[99999] h-[2.5px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-950 transition-all duration-200 ease-out shadow-[0_1px_6px_rgba(0,0,0,0.35)]"
        style={{
          width: `${progress}%`,
          opacity: active ? 1 : 0,
          transitionProperty: 'width, opacity',
        }}
      />
    </div>
  );
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
