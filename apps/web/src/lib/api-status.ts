export type ApiDownReason = 'unreachable' | 'error';

/** `null`: the check itself could not run (browser offline, web app failing), so it says nothing about the API. */
export type ApiCheck = { ok: true } | { ok: false; reason: ApiDownReason } | null;

export interface ApiStatus {
  failures: number;
  /** Time of the first failed check in the current run. */
  downSince: number | null;
  lastOkAt: number | null;
  lastCheckAt: number | null;
  reason: ApiDownReason | null;
}

/** After a longer gap (hidden tab, sleeping laptop) nothing is known about the time in between. */
const MAX_GAP_MS = 2 * 60_000;

/** One slow answer is not an outage. */
export const FAILURES_BEFORE_ALERT = 2;

export const INITIAL_API_STATUS: ApiStatus = { failures: 0, downSince: null, lastOkAt: null, lastCheckAt: null, reason: null };

export function nextApiStatus(prev: ApiStatus, check: ApiCheck, now: number): ApiStatus {
  if (check === null) return prev;
  if (check.ok) return { failures: 0, downSince: null, lastOkAt: now, lastCheckAt: now, reason: null };
  const continues = prev.lastCheckAt !== null && now - prev.lastCheckAt <= MAX_GAP_MS;
  return {
    failures: continues ? prev.failures + 1 : 1,
    downSince: continues ? (prev.downSince ?? now) : now,
    lastOkAt: prev.lastOkAt,
    lastCheckAt: now,
    reason: check.reason,
  };
}

export function isApiDown(status: ApiStatus): boolean {
  return status.failures >= FAILURES_BEFORE_ALERT;
}

/** Reads the body of `/api/health`; anything else (an HTML error page, say) is `null`. */
export function parseHealthBody(body: unknown): ApiCheck {
  if (typeof body !== 'object' || body === null) return null;
  const { ok, reason } = body as { ok?: unknown; reason?: unknown };
  if (ok === true) return { ok: true };
  if (ok === false) return { ok: false, reason: reason === 'unreachable' ? 'unreachable' : 'error' };
  return null;
}
