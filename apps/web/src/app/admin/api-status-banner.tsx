'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { INITIAL_API_STATUS, isApiDown, nextApiStatus, parseHealthBody, type ApiCheck } from '@/lib/api-status';

const POLL_MS = 30_000;
const CHECK_TIMEOUT_MS = 10_000;

const COPY = {
  id: {
    unreachable: 'API tidak bisa dijangkau.',
    error: 'API merespons dengan error.',
    justNow: 'Baru saja terdeteksi.',
    minutes: (n: number) => `Sudah ${n} menit.`,
    lastOk: (time: string) => `Terakhir normal ${time} WIB.`,
  },
  en: {
    unreachable: 'The API is unreachable.',
    error: 'The API is responding with errors.',
    justNow: 'Just detected.',
    minutes: (n: number) => `Down for ${n} min.`,
    lastOk: (time: string) => `Last healthy at ${time} WIB.`,
  },
};

async function checkApi(): Promise<ApiCheck> {
  if (!navigator.onLine) return null;
  try {
    const res = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    return parseHealthBody(await res.json());
  } catch {
    return null;
  }
}

export function ApiStatusBanner() {
  const { locale } = useTranslation();
  const [{ status, now }, setState] = useState({ status: INITIAL_API_STATUS, now: 0 });
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;

    const check = async () => {
      if (inFlight.current || document.visibilityState !== 'visible') return;
      inFlight.current = true;
      try {
        const result = await checkApi();
        if (!active) return;
        const at = Date.now();
        setState((prev) => ({ status: nextApiStatus(prev.status, result, at), now: at }));
      } finally {
        inFlight.current = false;
      }
    };

    void check();
    const poll = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      active = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!isApiDown(status) || status.downSince === null) return null;

  const copy = COPY[locale === 'id' ? 'id' : 'en'];
  const minutes = Math.floor((now - status.downSince) / 60_000);
  const lastOk =
    status.lastOkAt === null
      ? null
      : new Date(status.lastOkAt).toLocaleTimeString(locale === 'id' ? 'id-ID' : 'en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Jakarta',
        });

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        {/* Only this line is announced, so the minute counter is not read out on every check. */}
        <p role="alert" className="font-bold">
          {status.reason === 'unreachable' ? copy.unreachable : copy.error}
        </p>
        <p className="mt-0.5 text-red-800">
          {minutes < 1 ? copy.justNow : copy.minutes(minutes)}
          {lastOk && ` ${copy.lastOk(lastOk)}`}
        </p>
      </div>
    </div>
  );
}
