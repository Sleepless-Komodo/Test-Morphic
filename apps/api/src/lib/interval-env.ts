const MIN_INTERVAL_MS = 1_000;
/** Node silently turns a NaN, < 1 or larger timer delay into 1 ms. */
const MAX_INTERVAL_MS = 2 ** 31 - 1;

export const DEFAULT_DB_SYNC_INTERVAL_MS = 10 * 60_000;

type Warn = (message: string) => void;

/** Interval from the environment; an unusable value falls back to the default with a warning. */
export function intervalFromEnv(
  name: string,
  defaultMs: number,
  env: NodeJS.ProcessEnv = process.env,
  warn: Warn = console.warn,
): number {
  const raw = env[name];
  if (raw === undefined) return defaultMs;
  const value = Number(raw);
  if (value >= MIN_INTERVAL_MS && value <= MAX_INTERVAL_MS) return Math.floor(value);
  warn(`[config] ${name}=${JSON.stringify(raw)} is not a valid interval; using ${defaultMs} ms`);
  return defaultMs;
}

/** Same, except that 0, a negative value or an empty string turns the periodic sync off (returns 0). */
export function dbSyncIntervalMs(env: NodeJS.ProcessEnv = process.env, warn: Warn = console.warn): number {
  if (Number(env.DB_SYNC_INTERVAL_MS ?? DEFAULT_DB_SYNC_INTERVAL_MS) <= 0) return 0;
  return intervalFromEnv('DB_SYNC_INTERVAL_MS', DEFAULT_DB_SYNC_INTERVAL_MS, env, warn);
}
