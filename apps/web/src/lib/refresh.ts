// Auto-refreshed pages re-render every REFRESH_MS (plus up to 10% jitter, see AutoRefresh). A cached
// read only saves the database anything when it outlives one interval, so live reads use LIVE_TTL_MS
// and the heavy aggregates use SLOW_TTL_MS. A TTL at or below the interval misses on every refresh.
export const REFRESH_MS = 60_000;
export const LIVE_TTL_MS = 90_000;
export const SLOW_TTL_MS = 5 * 60_000;
