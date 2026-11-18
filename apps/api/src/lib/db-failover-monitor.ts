import {
  checkDatabaseParity,
  formatParitySummaryAlert,
  getDbFailoverState,
  getFallbackConnectionString,
  onDbFailover,
  safeHostLabel,
  sanitizeErrorForLog,
  syncPrimaryToFallback,
  type DatabaseParityReport,
  type DatabaseSyncReport,
  type DbFailoverEvent,
} from '@morphic/db';
import { sendOpsAlert } from './alert';
import { runLeased } from './job-lease';
import { runExclusiveSync } from './db-sync-queue';
import {
  consoleSyncLogger,
  dbSyncTracker,
  describeFullSyncReport,
  kv,
  parityVerdict,
  type SyncLogger,
  type SyncTracker,
} from './db-sync-log';

let lastParitySnapshot: DatabaseParityReport | null = null;
let unsubscribeFailover: (() => void) | null = null;

export function getLastParitySnapshot(): DatabaseParityReport | null {
  return lastParitySnapshot;
}

export function resetFailoverMonitorForTests(): void {
  lastParitySnapshot = null;
  if (unsubscribeFailover) {
    unsubscribeFailover();
    unsubscribeFailover = null;
  }
}

export interface HandleFailoverDeps {
  checkParity?: () => Promise<DatabaseParityReport>;
  sendAlert?: (message: string, payload: Record<string, unknown>) => Promise<void>;
  timeoutMs?: number;
}

async function checkParityWithTimeout(
  checkFn: () => Promise<DatabaseParityReport>,
  timeoutMs: number,
): Promise<DatabaseParityReport | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      checkFn(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function handleFailoverEvent(
  event: DbFailoverEvent,
  deps: HandleFailoverDeps = {},
): Promise<void> {
  const checkParity = deps.checkParity ?? (() => checkDatabaseParity());
  const sendAlert = deps.sendAlert ?? sendOpsAlert;
  const timeoutMs = deps.timeoutMs ?? 8_000;

  const liveReport = await checkParityWithTimeout(checkParity, timeoutMs);
  let effectiveReport: DatabaseParityReport | null = liveReport;
  let usedCachedSnapshot = false;

  if (liveReport && liveReport.primaryReachable) {
    lastParitySnapshot = liveReport;
  } else if (lastParitySnapshot) {
    effectiveReport = lastParitySnapshot;
    usedCachedSnapshot = true;
  }

  const paritySummary = formatParitySummaryAlert(effectiveReport);
  const snapshotTag = usedCachedSnapshot && effectiveReport
    ? ` [cached from ${effectiveReport.checkedAt}]`
    : '';
  const errorDetail = event.errorMessage ? ` (${event.errorMessage})` : '';

  const message =
    `🚨 [DB FAILOVER] Primary Neon DB switched to Fallback Local PostgreSQL (sticky mode). ` +
    `Reason: ${event.reason}${errorDetail}. ` +
    `Parity${snapshotTag}: ${paritySummary}`;

  await sendAlert(message, {
    type: 'db_failover',
    event,
    usedCachedSnapshot,
    parity: effectiveReport
      ? {
          checkedAt: effectiveReport.checkedAt,
          isCriticalMatch: effectiveReport.isCriticalMatch,
          isExactMatch: effectiveReport.isExactMatch,
          maxLagSeconds: effectiveReport.maxLagSeconds,
          driftedTables: effectiveReport.driftedTables.map((t) => ({
            table: t.tableName,
            delta: t.deltaRows,
          })),
          financialDiff: effectiveReport.financialDiff,
        }
      : null,
  });
}

/** One full primary->fallback sync. Returns null when not applicable. Throws on failure (callers log). */
export async function runPeriodicFallbackSync(): Promise<DatabaseSyncReport | null> {
  if (!getFallbackConnectionString()) return null;
  const isPrimaryActive = () => getDbFailoverState().activeTarget === 'primary';
  if (!isPrimaryActive()) return null;

  const report = await runExclusiveSync(async () => {
    if (!isPrimaryActive()) return null;
    return syncPrimaryToFallback({ skipLogs: true, abortIf: () => !isPrimaryActive() });
  });
  if (report) lastParitySnapshot = report.parityAfterSync;
  return report;
}

export interface FallbackSyncJobDeps {
  run?: () => Promise<DatabaseSyncReport | null>;
  log?: SyncLogger;
  tracker?: SyncTracker;
  now?: () => number;
}

/** Wraps a full sync with complete logging + failure tracking. Never throws. */
export async function runFallbackSyncJob(
  trigger: 'periodic' | 'boot',
  deps: FallbackSyncJobDeps = {},
): Promise<void> {
  const run = deps.run ?? runPeriodicFallbackSync;
  const log = deps.log ?? consoleSyncLogger;
  const tracker = deps.tracker ?? dbSyncTracker;
  const now = deps.now ?? (() => Date.now());
  const started = now();

  try {
    const report = await run();
    if (!report) {
      log.info(
        `[db-sync] skip kind=full trigger=${trigger} reason=${getFallbackConnectionString() ? 'failover-active' : 'fallback-not-configured'}`,
      );
      return;
    }
    const fields = describeFullSyncReport(report);
    const drift = fields.parity === 'DRIFT';
    tracker.ok('kind=full', { trigger, ...fields, durationMs: now() - started }, drift ? 'warn' : 'info');
    if (drift) {
      log.warn(`[db-sync] parity drift after ${trigger} sync: ${formatParitySummaryAlert(report.parityAfterSync)}`);
    }
    for (const w of report.warnings) log.warn(`[db-sync] sync warning: ${w}`);
  } catch (err) {
    if (err instanceof Error && err.name === 'SyncAbortedError') {
      log.warn(
        `[db-sync] abort kind=full trigger=${trigger} — failover activated mid-sync; local DB is authoritative, nothing was overwritten`,
      );
      return;
    }
    tracker.fail('kind=full', { trigger, durationMs: now() - started }, err, {
      alertAfter: trigger === 'boot' ? 1 : 3,
    });
  }
}

// ---------------------------------------------------------------------------
// Startup logging + self-check
// ---------------------------------------------------------------------------

function isLoopbackHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return false;
  }
}

/** Logs the resolved DB failover/sync configuration. Never prints credentials. */
export function logStartupConfig(log: SyncLogger = consoleSyncLogger): void {
  const fallbackUrl = getFallbackConnectionString();
  const primaryUrl = process.env.DATABASE_URL ?? 'postgresql://unset:unset@localhost:5432/unset';
  const state = getDbFailoverState();
  const syncOnWrite = process.env.DB_SYNC_ON_WRITE !== 'false';
  const interval = Number(process.env.DB_SYNC_INTERVAL_MS ?? 10 * 60_000);
  const periodicOn = Number.isFinite(interval) && interval > 0;
  const debounce = Number(process.env.DB_SYNC_ON_WRITE_DEBOUNCE_MS ?? 1500);
  const syncOnBoot = process.env.DB_SYNC_ON_BOOT !== 'false';

  log.info(
    `[db-sync] startup ${kv({
      primary: safeHostLabel(primaryUrl),
      fallback: fallbackUrl ? safeHostLabel(fallbackUrl) : 'not-configured',
      activeTarget: state.activeTarget,
      failover: state.failoverEnabled ? 'on' : 'off',
      syncOnWrite: fallbackUrl && syncOnWrite ? 'on' : 'off',
      debounceMs: Number.isFinite(debounce) ? debounce : 1500,
      periodicIntervalMs: fallbackUrl && periodicOn ? interval : 'off',
      syncOnBoot: fallbackUrl && syncOnBoot ? 'on' : 'off',
    })}`,
  );

  if (!fallbackUrl) {
    log.warn(
      '[db-sync] startup WARNING: DATABASE_URL_FALLBACK is not set — auto-failover and ALL fallback syncing (periodic, on-boot, on-write) are DISABLED',
    );
    return;
  }
  if (fallbackUrl === primaryUrl) {
    log.error(
      '[db-sync] startup ERROR: DATABASE_URL_FALLBACK is identical to DATABASE_URL — failover and sync are meaningless; fix the environment',
    );
  }
  if (!isLoopbackHost(fallbackUrl)) {
    log.warn(
      '[db-sync] startup WARNING: fallback host is not loopback (127.0.0.1/localhost) — make sure it is a private network address and never public',
    );
  }
  if (process.env.DB_FAILOVER_ENABLED === 'false') {
    log.warn('[db-sync] startup WARNING: auto-failover is OFF (DB_FAILOVER_ENABLED=false); syncing still runs');
  }
  if (process.env.DB_FORCE_FALLBACK === 'true') {
    log.warn(
      '[db-sync] startup WARNING: DB_FORCE_FALLBACK=true — serving from the fallback DB; primary->fallback syncing is DISABLED',
    );
  }
  if (!syncOnWrite) {
    log.warn(
      '[db-sync] startup WARNING: DB_SYNC_ON_WRITE=false — payments/redeems are NOT mirrored instantly; only the periodic sync keeps the fallback current',
    );
  }
  if (!periodicOn) {
    log.warn('[db-sync] startup WARNING: DB_SYNC_INTERVAL_MS is 0/invalid — periodic fallback sync is OFF');
  }
}

export interface StartupCheckDeps {
  checkParity?: () => Promise<DatabaseParityReport>;
  sendAlert?: (message: string, payload: Record<string, unknown>) => Promise<void>;
  log?: SyncLogger;
  runBootSync?: () => Promise<void>;
  timeoutMs?: number;
}

async function defaultBootSync(): Promise<void> {
  const interval = Number(process.env.DB_SYNC_INTERVAL_MS ?? 10 * 60_000);
  const leaseMs = Number.isFinite(interval) && interval > 0 ? interval : 10 * 60_000;
  const outcome = await runLeased('db-fallback-sync', leaseMs, () => runFallbackSyncJob('boot'));
  if (outcome === 'skipped_lease_held') {
    consoleSyncLogger.info('[db-sync] boot catch-up sync skipped: another node already synced within the lease window');
  } else if (outcome === 'skipped_lease_error') {
    consoleSyncLogger.warn('[db-sync] boot catch-up sync skipped: could not claim the job lease (see [job-lease] error above)');
  } else if (outcome === 'failed') {
    consoleSyncLogger.error('[db-sync] boot catch-up sync job crashed (see [job-lease] error above)');
  }
}

/** Verifies the fallback DB is usable right after boot, then runs a catch-up sync. */
export async function runStartupSelfCheck(deps: StartupCheckDeps = {}): Promise<void> {
  const log = deps.log ?? consoleSyncLogger;
  const sendAlert = deps.sendAlert ?? sendOpsAlert;
  if (!getFallbackConnectionString()) return; // logStartupConfig already announced this

  const report = await checkParityWithTimeout(
    deps.checkParity ?? (() => checkDatabaseParity()),
    deps.timeoutMs ?? 20_000,
  );
  if (!report) {
    log.error(
      '[db-sync] startup check FAILED: parity check timed out or crashed — cannot confirm the fallback database is usable',
    );
    await sendAlert(
      '🚨 [DB SYNC] Startup check gagal: tidak bisa memastikan Postgres lokal siap dipakai (timeout/error).',
      { type: 'db_startup_check_failed' },
    ).catch((e) => log.error(`[db-sync] alert delivery failed: ${sanitizeErrorForLog(e)}`));
    return;
  }
  if (report.primaryReachable) lastParitySnapshot = report;

  const verdict = parityVerdict(report);
  const usable = report.fallbackReachable && report.fallbackPermissionsOk && report.migrationsMatch;
  const level = !usable ? 'error' : verdict === 'DRIFT' ? 'warn' : 'info';
  log[level](
    `[db-sync] startup check ${kv({
      primary: report.primaryReachable ? 'ONLINE' : 'UNREACHABLE',
      fallback: report.fallbackReachable ? 'ONLINE' : 'UNREACHABLE',
      permissions: report.fallbackPermissionsOk ? 'ok' : 'missing',
      migrations: report.migrationsMatch
        ? 'match'
        : `mismatch(primary=${report.primaryMigrationsCount},fallback=${report.fallbackMigrationsCount})`,
      parity: verdict,
      maxLagSec: report.maxLagSeconds,
      driftedTables: report.driftedTables.length,
    })}`,
  );
  for (const w of report.warnings) log.warn(`[db-sync] startup check warning: ${w}`);

  if (!usable) {
    await sendAlert(
      `🚨 [DB SYNC] Saat startup Postgres lokal TIDAK siap (reachable=${report.fallbackReachable} permissions=${report.fallbackPermissionsOk} migrations=${report.migrationsMatch}). Auto-failover tidak akan berfungsi sampai diperbaiki.`,
      { type: 'db_startup_fallback_unusable' },
    ).catch((e) => log.error(`[db-sync] alert delivery failed: ${sanitizeErrorForLog(e)}`));
    return;
  }

  if (process.env.DB_SYNC_ON_BOOT === 'false') {
    log.info('[db-sync] startup: catch-up sync on boot is disabled (DB_SYNC_ON_BOOT=false)');
    return;
  }
  if (!report.primaryReachable) {
    log.warn('[db-sync] startup: primary unreachable — skipping boot catch-up sync');
    return;
  }
  if (verdict === 'DRIFT') {
    log.warn('[db-sync] startup: local fallback is behind the primary — running catch-up sync now');
  }
  await (deps.runBootSync ?? defaultBootSync)();
}

export function scheduleStartupSelfCheck(delayMs = 3000): void {
  if (!getFallbackConnectionString()) return;
  const timer = setTimeout(() => {
    void runStartupSelfCheck().catch((err) =>
      consoleSyncLogger.error(`[db-sync] startup check crashed: ${sanitizeErrorForLog(err)}`),
    );
  }, delayMs);
  timer.unref?.();
}

export function initDbFailoverMonitor(): () => void {
  if (unsubscribeFailover) return unsubscribeFailover;

  logStartupConfig();
  const state = getDbFailoverState();
  if (state.fallbackConfigured && state.activeTarget === 'fallback') {
    console.warn(`[db-monitor] booted directly in fallback mode (${state.failoverReason ?? 'forced'})`);
  }

  unsubscribeFailover = onDbFailover((event) => {
    void handleFailoverEvent(event).catch((err) => {
      console.error(`[db-monitor] failed to process failover alert: ${sanitizeErrorForLog(err)}`);
    });
  });

  return unsubscribeFailover;
}
