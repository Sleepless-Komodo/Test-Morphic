import { sanitizeErrorForLog, type DatabaseParityReport, type DatabaseSyncReport } from '@morphic/db';
import { sendOpsAlert } from './alert';

export interface SyncLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export const consoleSyncLogger: SyncLogger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m),
};

export type KvValue = string | number | boolean | null | undefined;

/** `a=1 b=- d=x` (null -> '-', undefined dropped). Values must never contain secrets. */
export function kv(fields: Record<string, KvValue>): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v === null ? '-' : String(v)}`)
    .join(' ');
}

export type ParityVerdict = 'EXACT' | 'CRITICAL' | 'DRIFT';

export function parityVerdict(
  report: Pick<DatabaseParityReport, 'isExactMatch' | 'isCriticalMatch'>,
): ParityVerdict {
  return report.isExactMatch ? 'EXACT' : report.isCriticalMatch ? 'CRITICAL' : 'DRIFT';
}

export function describeFullSyncReport(report: DatabaseSyncReport): Record<string, KvValue> {
  return {
    rowsFetched: report.totalRowsFetched,
    rowsUpserted: report.totalRowsUpserted,
    tablesTouched: report.tablesSynced.filter((t) => !t.skipped && t.rowsUpserted > 0).length,
    parity: parityVerdict(report.parityAfterSync),
    maxLagSec: report.parityAfterSync.maxLagSeconds,
    driftedTables: report.parityAfterSync.driftedTables.length,
  };
}

export interface SyncTrackerDeps {
  log: SyncLogger;
  sendAlert: (message: string, payload: Record<string, unknown>) => Promise<void>;
  now: () => number;
  alertCooldownMs: number;
}

export interface DbSyncStatus {
  lastOkAt: string | null;
  lastFailAt: string | null;
  consecutiveFailures: number;
  suppressedAlerts: number;
}

/**
 * One shared place that logs every sync outcome, counts consecutive failures and alerts
 * (Telegram/webhook) with a cooldown. A failure is NEVER silent: it is always logged,
 * only the Telegram message is throttled.
 */
export function createSyncTracker(deps: SyncTrackerDeps) {
  let lastOkAt: number | null = null;
  let lastFailAt: number | null = null;
  let consecutiveFailures = 0;
  let lastAlertAt = Number.NEGATIVE_INFINITY;
  let failureAlertSent = false;
  let suppressed = 0;

  const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());

  const dispatch = (message: string, payload: Record<string, unknown>) => {
    void Promise.resolve()
      .then(() => deps.sendAlert(message, payload))
      .catch((e) => deps.log.error(`[db-sync] alert delivery failed: ${sanitizeErrorForLog(e)}`));
  };

  function ok(label: string, fields: Record<string, KvValue>, level: 'info' | 'warn' = 'info'): void {
    const previousFailures = consecutiveFailures;
    lastOkAt = deps.now();
    consecutiveFailures = 0;
    deps.log[level](`[db-sync] ok ${label} ${kv(fields)}`);
    if (previousFailures > 0) {
      deps.log.warn(`[db-sync] RECOVERED after ${previousFailures} consecutive failure(s)`);
      if (failureAlertSent) {
        failureAlertSent = false;
        suppressed = 0;
        dispatch(`✅ [DB SYNC] Sync ke Postgres lokal pulih setelah ${previousFailures} kegagalan beruntun.`, {
          type: 'db_sync_recovered',
          previousFailures,
        });
      }
    }
  }

  function fail(
    label: string,
    fields: Record<string, KvValue>,
    err: unknown,
    opts: { alertAfter: number },
  ): void {
    const detail = sanitizeErrorForLog(err);
    lastFailAt = deps.now();
    consecutiveFailures += 1;
    deps.log.error(
      `[db-sync] FAIL ${label} ${kv({ ...fields, consecutiveFailures, error: JSON.stringify(detail) })}`,
    );
    if (consecutiveFailures < opts.alertAfter) return;

    const t = deps.now();
    if (t - lastAlertAt < deps.alertCooldownMs) {
      suppressed += 1;
      deps.log.warn(
        `[db-sync] alert suppressed by cooldown (suppressed=${suppressed}); failures are still logged above`,
      );
      return;
    }
    lastAlertAt = t;
    failureAlertSent = true;
    const extra = suppressed > 0 ? ` (+${suppressed} kegagalan lain sejak alert terakhir)` : '';
    suppressed = 0;
    dispatch(
      `⚠️ [DB SYNC] ${label} gagal (${consecutiveFailures} beruntun): ${detail}. Postgres lokal bisa tertinggal sampai sync berikutnya berhasil.${extra}`,
      { type: 'db_sync_failed', label, consecutiveFailures, ...fields },
    );
  }

  function status(): DbSyncStatus {
    return {
      lastOkAt: iso(lastOkAt),
      lastFailAt: iso(lastFailAt),
      consecutiveFailures,
      suppressedAlerts: suppressed,
    };
  }

  return { ok, fail, status };
}

export type SyncTracker = ReturnType<typeof createSyncTracker>;

export const dbSyncTracker: SyncTracker = createSyncTracker({
  log: consoleSyncLogger,
  sendAlert: sendOpsAlert,
  now: () => Date.now(),
  alertCooldownMs: 10 * 60_000,
});
