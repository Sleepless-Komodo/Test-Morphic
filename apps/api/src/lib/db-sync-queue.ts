import {
  SyncAbortedError,
  getDbFailoverState,
  getFallbackConnectionString,
  sanitizeErrorForLog,
  syncPrimaryToFallback,
  syncTargetedToFallback,
  type TargetedSyncInput,
} from '@morphic/db';
import {
  consoleSyncLogger,
  dbSyncTracker,
  describeFullSyncReport,
  kv,
  type KvValue,
  type SyncLogger,
  type SyncTracker,
} from './db-sync-log';

export type { TargetedSyncInput };

/**
 * Process-wide mutex: targeted sync, periodic sync and escalation full sync never run
 * concurrently (overlapping copies could write a stale snapshot over a newer one).
 */
let syncChain: Promise<unknown> = Promise.resolve();
export function runExclusiveSync<T>(fn: () => Promise<T>): Promise<T> {
  const run = syncChain.then(() => fn());
  syncChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export type SyncEnabledState =
  | { enabled: true }
  | { enabled: false; reason: 'fallback-not-configured' | 'disabled-by-config' | 'failover-active' };

export interface TargetedRunSummary {
  userId?: string;
  totalRowsUpserted?: number;
  tables?: Array<{ tableName: string; rowsUpserted: number }>;
}

export interface TargetedSyncQueueDeps {
  checkEnabled: () => SyncEnabledState;
  runTargeted: (input: TargetedSyncInput) => Promise<TargetedRunSummary | undefined>;
  runFull: () => Promise<Record<string, KvValue> | undefined>;
  tracker: SyncTracker;
  log: SyncLogger;
  debounceMs: number;
  retryDelaysMs: number[];
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const SKIP_LOG_INTERVAL_MS = 10 * 60_000;

const summarizeTables = (tables?: Array<{ tableName: string; rowsUpserted: number }>): string =>
  (tables ?? [])
    .filter((t) => t.rowsUpserted > 0)
    .map((t) => `${t.tableName}:${t.rowsUpserted}`)
    .join(',') || '-';

export function createTargetedSyncQueue(deps: TargetedSyncQueueDeps) {
  const pending = new Map<string, TargetedSyncInput>();
  const skipLoggedAt = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let draining: Promise<void> | null = null;

  const keyOf = (i: TargetedSyncInput) => `${i.userId ?? '-'}|${i.paymentId ?? '-'}|${i.redeemCodeId ?? '-'}`;
  const idsOf = (i: TargetedSyncInput) => ({
    trigger: i.paymentId ? 'payment' : 'redeem',
    paymentId: i.paymentId ?? null,
    redeemCodeId: i.redeemCodeId ?? null,
    userId: i.userId ?? null,
  });
  const isAbort = (err: unknown) =>
    (err instanceof Error && err.name === 'SyncAbortedError') || !deps.checkEnabled().enabled;

  function logSkip(reason: string, ids: Record<string, KvValue>): void {
    const t = deps.now();
    const last = skipLoggedAt.get(reason) ?? Number.NEGATIVE_INFINITY;
    if (t - last < SKIP_LOG_INTERVAL_MS) return;
    skipLoggedAt.set(reason, t);
    deps.log.info(
      `[db-sync] skip kind=targeted reason=${reason} ${kv(ids)} (further skips for this reason are not logged for 10 min)`,
    );
  }

  function logAbort(kind: string, ids: Record<string, KvValue>): void {
    deps.log.warn(
      `[db-sync] abort kind=${kind} ${kv(ids)} — failover activated or sync disabled mid-flight; local DB is authoritative, nothing was overwritten`,
    );
  }

  async function processOne(input: TargetedSyncInput): Promise<void> {
    const ids = idsOf(input);
    const state = deps.checkEnabled();
    if (!state.enabled) {
      logSkip(state.reason, ids);
      return;
    }

    const started = deps.now();
    const maxAttempts = deps.retryDelaysMs.length + 1;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await deps.runTargeted(input);
        deps.tracker.ok('kind=targeted', {
          ...ids,
          userId: res?.userId ?? ids.userId,
          rows: res?.totalRowsUpserted ?? 0,
          tables: summarizeTables(res?.tables),
          attempt,
          durationMs: deps.now() - started,
        });
        return;
      } catch (err) {
        lastErr = err;
        if (isAbort(err)) {
          logAbort('targeted', ids);
          return;
        }
        deps.log.error(
          `[db-sync] FAIL attempt kind=targeted attempt=${attempt}/${maxAttempts} ${kv(ids)} error=${JSON.stringify(sanitizeErrorForLog(err))}`,
        );
        if (attempt < maxAttempts) await deps.sleep(deps.retryDelaysMs[attempt - 1]!);
      }
    }

    deps.log.warn(
      `[db-sync] ESCALATE kind=targeted->full ${kv(ids)} reason=${JSON.stringify(sanitizeErrorForLog(lastErr))}`,
    );
    try {
      const fields = await deps.runFull();
      deps.tracker.ok(
        'kind=full',
        {
          trigger: 'escalation',
          paymentId: ids.paymentId,
          redeemCodeId: ids.redeemCodeId,
          ...(fields ?? {}),
          durationMs: deps.now() - started,
        },
        fields?.parity === 'DRIFT' ? 'warn' : 'info',
      );
      return;
    } catch (fullErr) {
      if (isAbort(fullErr)) {
        logAbort('full', ids);
        return;
      }
      lastErr = fullErr;
    }

    deps.tracker.fail('kind=targeted+full', { ...ids, durationMs: deps.now() - started }, lastErr, {
      alertAfter: 1,
    });
    deps.log.error(
      `[db-sync] GIVE-UP ${kv(ids)} — local fallback is STALE for this operation until the next successful sync (periodic sync runs every DB_SYNC_INTERVAL_MS)`,
    );
  }

  async function drain(): Promise<void> {
    while (pending.size > 0) {
      const [key, input] = pending.entries().next().value as [string, TargetedSyncInput];
      pending.delete(key);
      await processOne(input).catch((e) =>
        deps.log.error(`[db-sync] unexpected queue error: ${sanitizeErrorForLog(e)}`),
      );
    }
  }

  function startDrain(): void {
    if (draining) return;
    draining = drain().finally(() => {
      draining = null;
      if (pending.size > 0) arm();
    });
  }

  function arm(): void {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      startDrain();
    }, deps.debounceMs);
    timer.unref?.();
  }

  /** Fire-and-forget. Never throws and never blocks the request path. */
  function schedule(input: TargetedSyncInput): void {
    try {
      if (!input.userId && !input.paymentId) {
        deps.log.warn(
          `[db-sync] skip kind=targeted reason=invalid-input (userId or paymentId required) ${kv(idsOf(input))}`,
        );
        return;
      }
      const state = deps.checkEnabled();
      if (!state.enabled) {
        logSkip(state.reason, idsOf(input));
        return;
      }
      pending.set(keyOf(input), input);
      arm();
    } catch (e) {
      deps.log.error(
        `[db-sync] schedule failed (sync-on-write skipped for this operation): ${sanitizeErrorForLog(e)}`,
      );
    }
  }

  /** Resolves when the queue is completely idle (tests, graceful shutdown). */
  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    while (pending.size > 0 || draining) {
      startDrain();
      if (draining) await draining;
    }
  }

  return { schedule, flush, pendingCount: () => pending.size };
}

const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

function checkSyncOnWriteEnabled(): SyncEnabledState {
  if (!getFallbackConnectionString()) return { enabled: false, reason: 'fallback-not-configured' };
  if (process.env.DB_SYNC_ON_WRITE === 'false') return { enabled: false, reason: 'disabled-by-config' };
  if (getDbFailoverState().activeTarget !== 'primary') return { enabled: false, reason: 'failover-active' };
  return { enabled: true };
}
const isSyncOnWriteOn = (): boolean => checkSyncOnWriteEnabled().enabled;

const defaultQueue = createTargetedSyncQueue({
  checkEnabled: checkSyncOnWriteEnabled,
  runTargeted: (input) =>
    runExclusiveSync(async () => {
      if (!isSyncOnWriteOn()) throw new SyncAbortedError();
      return syncTargetedToFallback(input, { abortIf: () => !isSyncOnWriteOn() });
    }),
  runFull: () =>
    runExclusiveSync(async () => {
      if (!isSyncOnWriteOn()) throw new SyncAbortedError();
      const report = await syncPrimaryToFallback({ skipLogs: true, abortIf: () => !isSyncOnWriteOn() });
      return describeFullSyncReport(report);
    }),
  tracker: dbSyncTracker,
  log: consoleSyncLogger,
  debounceMs: envNumber('DB_SYNC_ON_WRITE_DEBOUNCE_MS', 1500),
  retryDelaysMs: [2000],
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});

/** Call right AFTER a payment/redeem transaction committed. Safe no-op when fallback is off (the skip is logged). */
export function scheduleTargetedSync(input: TargetedSyncInput): void {
  defaultQueue.schedule(input);
}
