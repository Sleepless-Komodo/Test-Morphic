'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const HEALTH_ENDPOINT = '/api/health';
const PING_INTERVAL_MS = 60_000;

type GatewayState = 'checking' | 'operational' | 'degraded';

const SERVICES = [
  { name: 'Core API Gateway (/v1)', nameId: 'Core API Gateway (/v1)' },
  { name: 'Billing & Settlement Engine', nameId: 'Billing & Settlement Engine' },
  { name: 'DeepSeek Cluster', nameId: 'DeepSeek Cluster' },
  { name: 'Claude Anthropic Proxy', nameId: 'Claude Anthropic Proxy' },
  { name: 'Qwen & Kimi Router', nameId: 'Qwen & Kimi Router' },
];

export default function GatewayStatusPopover() {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GatewayState>('checking');
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [liveProviders, setLiveProviders] = useState<Array<{ name: string; status: string; errorRate: number }>>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const ping = useCallback(async () => {
    const started = performance.now();
    try {
      const res = await fetch(HEALTH_ENDPOINT, { cache: 'no-store' });
      const latency = Math.round(performance.now() - started);
      setPingMs(latency);
      if (res.ok) {
        const data = await res.json();
        setState(data.status ?? 'operational');
        if (Array.isArray(data.providers) && data.providers.length > 0) {
          setLiveProviders(data.providers);
        }
      } else {
        setState('degraded');
      }
    } catch {
      setPingMs(null);
      setState('degraded');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState runs after await, not synchronously
    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ping]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const operational = state === 'operational';
  const pillLabel =
    state === 'checking'
      ? t.dashboard.statusChecking
      : operational
        ? t.dashboard.statusOperational
        : t.dashboard.statusDegraded;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
          state === 'degraded'
            ? 'border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100'
            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-950'
        }`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              state === 'checking'
                ? 'bg-neutral-300'
                : operational
                  ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-amber-500 ring-2 ring-amber-500/20'
            }`}
          />
        </span>
        <span suppressHydrationWarning>{pillLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.dashboard.statusTitle}
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div
                suppressHydrationWarning
                className={`text-sm font-bold ${operational ? 'text-neutral-950' : 'text-amber-700'}`}
              >
                {operational ? t.dashboard.statusAllOperational : t.dashboard.statusDegradedTitle}
              </div>
              <div suppressHydrationWarning className="text-[11px] text-neutral-500 mt-0.5">
                {t.dashboard.statusUptime}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-neutral-400">{t.dashboard.statusPing}</div>
              <div className="font-mono text-sm font-bold text-neutral-950">
                {state === 'checking' ? '—' : pingMs !== null ? `${pingMs} ms` : '—'}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-neutral-100 pt-3">
            {liveProviders.length > 0 ? (
              liveProviders.map((prov) => {
                const isHealthy = prov.status === 'healthy';
                return (
                  <div key={prov.name} className="flex items-center justify-between text-xs py-1">
                    <span className="text-neutral-700 capitalize font-medium">
                      {prov.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 font-semibold text-[11px] ${
                        isHealthy ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      {isHealthy
                        ? (locale === 'id' ? 'Aktif' : 'Operational')
                        : (locale === 'id' ? 'Terganggu' : 'Degraded')}
                    </span>
                  </div>
                );
              })
            ) : (
              SERVICES.map((service) => (
                <div key={service.name} className="flex items-center justify-between text-xs py-1">
                  <span suppressHydrationWarning className="text-neutral-600">
                    {locale === 'id' ? service.nameId : service.name}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 font-semibold ${
                      operational ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        operational ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {operational
                      ? t.dashboard.statusServiceOperational
                      : (locale === 'id' ? 'Terganggu' : 'Degraded')}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
            <span suppressHydrationWarning>{t.dashboard.statusPingNote}</span>
          </div>
        </div>
      )}
    </div>
  );
}
