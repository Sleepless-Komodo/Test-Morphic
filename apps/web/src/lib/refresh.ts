// Auto-refreshed pages re-render every REFRESH_MS (plus up to 10% jitter, see AutoRefresh). A cached
// read only saves the database anything when it outlives one interval, so live reads use LIVE_TTL_MS
// and the heavy aggregates use SLOW_TTL_MS. A TTL at or below the interval misses on every refresh.
export const REFRESH_MS = 60_000;
export const LIVE_TTL_MS = 90_000;
export const SLOW_TTL_MS = 5 * 60_000;

// An unattended tab stops auto-refreshing after this long without pointer, key or touch input.
// Each admin-page refresh counts as admin activity, so without the stop a tab left open would keep
// the 24-hour admin OTP window from ever running out (and keep querying the database for nobody).
export const REFRESH_IDLE_STOP_MS = 30 * 60_000;

export function shouldAutoRefresh(input: {
  nowMs: number;
  lastRefreshMs: number;
  lastInputMs: number;
  intervalMs: number;
}): boolean {
  const stale = input.nowMs - input.lastRefreshMs >= input.intervalMs;
  const attended = input.nowMs - input.lastInputMs < REFRESH_IDLE_STOP_MS;
  return stale && attended;
}
