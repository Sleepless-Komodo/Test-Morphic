import { and, asc, getTableColumns, gt, gte, inArray, or, eq, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import {
  createDbHandle,
  extractExecuteRows,
  getConnectionString,
  getFallbackConnectionString,
} from './index.ts';
import * as s from './schema.ts';
import { checkDatabaseParity, type DatabaseParityReport } from './parity.ts';

/** Thrown when a sync is stopped because the primary is no longer the active write target. */
export class SyncAbortedError extends Error {
  constructor() {
    super('[db-sync] aborted: primary is no longer the active database');
    this.name = 'SyncAbortedError';
  }
}

export interface TableSyncSpec {
  tableName: string;
  table: PgTable;
  pkProp: string;
  pkCol: AnyColumn;
  mode: 'upsert' | 'append_watermark';
  tsProp?: string;
  tsCol?: AnyColumn;
  tsColSql?: string;
}

/**
 * Sync order respects Foreign Key hierarchy strictly (Tier 1 -> Tier 5)
 * so incremental/full upserts into the local fallback DB never violate FKs.
 */
const SYNC_PLAN: readonly TableSyncSpec[] = [
  // Tier 1: No foreign key dependencies
  { tableName: 'users', table: s.users, pkProp: 'id', pkCol: s.users.id, mode: 'upsert' },
  { tableName: 'providers', table: s.providers, pkProp: 'id', pkCol: s.providers.id, mode: 'upsert' },
  { tableName: 'verifications', table: s.verifications, pkProp: 'id', pkCol: s.verifications.id, mode: 'upsert' },
  { tableName: 'job_leases', table: s.jobLeases, pkProp: 'job', pkCol: s.jobLeases.job, mode: 'upsert' },

  // Tier 2: Depends on Tier 1
  { tableName: 'accounts', table: s.accounts, pkProp: 'id', pkCol: s.accounts.id, mode: 'upsert' },
  { tableName: 'sessions', table: s.sessions, pkProp: 'id', pkCol: s.sessions.id, mode: 'upsert' },
  { tableName: 'two_factor', table: s.twoFactors, pkProp: 'id', pkCol: s.twoFactors.id, mode: 'upsert' },
  { tableName: 'api_keys', table: s.apiKeys, pkProp: 'id', pkCol: s.apiKeys.id, mode: 'upsert' },
  { tableName: 'models', table: s.models, pkProp: 'id', pkCol: s.models.id, mode: 'upsert' },
  { tableName: 'balances', table: s.balances, pkProp: 'userId', pkCol: s.balances.userId, mode: 'upsert' },
  { tableName: 'announcements', table: s.announcements, pkProp: 'id', pkCol: s.announcements.id, mode: 'upsert' },
  {
    tableName: 'admin_audit_log',
    table: s.adminAuditLog,
    pkProp: 'id',
    pkCol: s.adminAuditLog.id,
    mode: 'append_watermark',
    tsProp: 'createdAt',
    tsCol: s.adminAuditLog.createdAt,
    tsColSql: 'created_at',
  },
  { tableName: 'dsar_requests', table: s.dsarRequests, pkProp: 'id', pkCol: s.dsarRequests.id, mode: 'upsert' },

  // Tier 3: Depends on Tier 1 & 2
  {
    tableName: 'model_provider_pool',
    table: s.modelProviderPool,
    pkProp: 'id',
    pkCol: s.modelProviderPool.id,
    mode: 'upsert',
  },
  { tableName: 'packages', table: s.packages, pkProp: 'id', pkCol: s.packages.id, mode: 'upsert' },
  { tableName: 'redeem_codes', table: s.redeemCodes, pkProp: 'id', pkCol: s.redeemCodes.id, mode: 'upsert' },
  { tableName: 'reservations', table: s.reservations, pkProp: 'id', pkCol: s.reservations.id, mode: 'upsert' },
  {
    tableName: 'usage_records',
    table: s.usageRecords,
    pkProp: 'id',
    pkCol: s.usageRecords.id,
    mode: 'append_watermark',
    tsProp: 'createdAt',
    tsCol: s.usageRecords.createdAt,
    tsColSql: 'created_at',
  },
  { tableName: 'abuse_cases', table: s.abuseCases, pkProp: 'id', pkCol: s.abuseCases.id, mode: 'upsert' },

  // Tier 4: Depends on Tier 1-3
  { tableName: 'entitlements', table: s.entitlements, pkProp: 'id', pkCol: s.entitlements.id, mode: 'upsert' },
  { tableName: 'payments', table: s.payments, pkProp: 'id', pkCol: s.payments.id, mode: 'upsert' },
  {
    tableName: 'payment_events',
    table: s.paymentEvents,
    pkProp: 'id',
    pkCol: s.paymentEvents.id,
    mode: 'append_watermark',
    tsProp: 'processedAt',
    tsCol: s.paymentEvents.processedAt,
    tsColSql: 'created_at',
  },
  {
    tableName: 'credit_ledger',
    table: s.creditLedger,
    pkProp: 'id',
    pkCol: s.creditLedger.id,
    mode: 'append_watermark',
    tsProp: 'createdAt',
    tsCol: s.creditLedger.createdAt,
    tsColSql: 'created_at',
  },
  { tableName: 'redemptions', table: s.redemptions, pkProp: 'id', pkCol: s.redemptions.id, mode: 'upsert' },
  { tableName: 'gift_cards', table: s.giftCards, pkProp: 'id', pkCol: s.giftCards.id, mode: 'upsert' },

  // Tier 5: High-volume request logs (can be skipped via skipLogs=true)
  {
    tableName: 'request_logs',
    table: s.requestLogs,
    pkProp: 'id',
    pkCol: s.requestLogs.id,
    mode: 'append_watermark',
    tsProp: 'createdAt',
    tsCol: s.requestLogs.createdAt,
    tsColSql: 'created_at',
  },
];

export interface SyncOptions {
  primaryUrl?: string;
  fallbackUrl?: string;
  dryRun?: boolean;
  skipLogs?: boolean;
  forceFull?: boolean;
  batchSize?: number;
  overlapMinutes?: number;
  /** Checked before every write batch; return true to stop (e.g. failover happened). */
  abortIf?: () => boolean;
}

export interface TableSyncResult {
  tableName: string;
  skipped: boolean;
  skipReason?: string;
  rowsFetched: number;
  rowsUpserted: number;
}

export interface DatabaseSyncReport {
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
  tablesSynced: TableSyncResult[];
  totalRowsFetched: number;
  totalRowsUpserted: number;
  warnings: string[];
  parityAfterSync: DatabaseParityReport;
}

function buildConflictUpdateSet(table: PgTable, pkProp: string): Record<string, SQL> {
  const cols = getTableColumns(table);
  const set: Record<string, SQL> = {};
  for (const [prop, col] of Object.entries(cols)) {
    if (prop === pkProp) continue;
    set[prop] = sql.raw(`excluded."${col.name}"`);
  }
  return set;
}

async function listPublicTables(handle: ReturnType<typeof createDbHandle>): Promise<Set<string>> {
  const rows = extractExecuteRows<{ table_name: string }>(
    await handle.db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `),
  );
  return new Set(rows.map((r) => r.table_name));
}

async function syncUpsertTable(
  primaryHandle: ReturnType<typeof createDbHandle>,
  fallbackHandle: ReturnType<typeof createDbHandle>,
  spec: TableSyncSpec,
  batchSize: number,
  dryRun: boolean,
  abortIf?: () => boolean,
): Promise<{ rowsFetched: number; rowsUpserted: number }> {
  const primaryDb = primaryHandle.db as any;
  const fallbackDb = fallbackHandle.db as any;
  const updateSet = buildConflictUpdateSet(spec.table, spec.pkProp);

  let lastPk: unknown = null;
  let rowsFetched = 0;
  let rowsUpserted = 0;

  while (true) {
    const query = primaryDb.select().from(spec.table);
    const batch: Array<Record<string, unknown>> =
      lastPk === null
        ? await query.orderBy(asc(spec.pkCol)).limit(batchSize)
        : await query.where(gt(spec.pkCol, lastPk)).orderBy(asc(spec.pkCol)).limit(batchSize);

    if (batch.length === 0) break;

    rowsFetched += batch.length;
    lastPk = batch[batch.length - 1]![spec.pkProp];

    if (!dryRun) {
      if (abortIf?.()) throw new SyncAbortedError();
      await fallbackDb
        .insert(spec.table)
        .values(batch)
        .onConflictDoUpdate({
          target: spec.pkCol,
          set: updateSet,
        });
      rowsUpserted += batch.length;
    }

    if (batch.length < batchSize) break;
  }

  return { rowsFetched, rowsUpserted };
}

async function syncAppendWatermarkTable(
  primaryHandle: ReturnType<typeof createDbHandle>,
  fallbackHandle: ReturnType<typeof createDbHandle>,
  spec: TableSyncSpec,
  batchSize: number,
  overlapMinutes: number,
  forceFull: boolean,
  dryRun: boolean,
  abortIf?: () => boolean,
): Promise<{ rowsFetched: number; rowsUpserted: number }> {
  const primaryDb = primaryHandle.db as any;
  const fallbackDb = fallbackHandle.db as any;
  const tsCol = spec.tsCol!;
  const tsColSql = spec.tsColSql!;

  let sinceDate: Date | null = null;
  if (!forceFull) {
    const wmRows = extractExecuteRows<{ max_ts: string | null }>(
      await fallbackDb.execute(
        sql.raw(`SELECT max("${tsColSql}")::text AS max_ts FROM "public"."${spec.tableName}"`),
      ),
    );
    const rawMax = wmRows[0]?.max_ts;
    if (rawMax) {
      const parsed = Date.parse(rawMax);
      if (Number.isFinite(parsed)) {
        sinceDate = new Date(parsed - overlapMinutes * 60_000);
      }
    }
  }

  let cursorTs: Date | null = null;
  let cursorPk: unknown = null;
  let rowsFetched = 0;
  let rowsUpserted = 0;

  while (true) {
    const conditions: SQL[] = [];
    if (sinceDate) {
      conditions.push(gte(tsCol, sinceDate));
    }
    if (cursorTs !== null && cursorPk !== null) {
      const cursorCond = or(
        gt(tsCol, cursorTs),
        and(eq(tsCol, cursorTs), gt(spec.pkCol, cursorPk)),
      );
      if (cursorCond) conditions.push(cursorCond);
    }

    const baseQuery = primaryDb.select().from(spec.table);
    const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const batch: Array<Record<string, unknown>> = await filteredQuery
      .orderBy(asc(tsCol), asc(spec.pkCol))
      .limit(batchSize);

    if (batch.length === 0) break;

    rowsFetched += batch.length;
    const lastRow = batch[batch.length - 1]!;
    const rawTs = spec.tsProp ? lastRow[spec.tsProp] : undefined;
    cursorTs = rawTs instanceof Date ? rawTs : new Date(String(rawTs));
    cursorPk = lastRow[spec.pkProp];

    if (!dryRun) {
      if (abortIf?.()) throw new SyncAbortedError();
      await fallbackDb.insert(spec.table).values(batch).onConflictDoNothing();
      rowsUpserted += batch.length;
    }

    if (batch.length < batchSize) break;
  }

  return { rowsFetched, rowsUpserted };
}

/**
 * Synchronizes data one-way from Primary (`DATABASE_URL`) to Fallback (`DATABASE_URL_FALLBACK`)
 * following strict foreign-key order, then validates parity with `checkDatabaseParity()`.
 */
export async function syncPrimaryToFallback(options: SyncOptions = {}): Promise<DatabaseSyncReport> {
  const startedAt = new Date().toISOString();
  const primaryUrl = options.primaryUrl ?? getConnectionString();
  const fallbackUrl = options.fallbackUrl ?? getFallbackConnectionString();

  if (!fallbackUrl) {
    throw new Error('[db-sync] DATABASE_URL_FALLBACK is not configured');
  }
  if (primaryUrl === fallbackUrl) {
    throw new Error('[db-sync] Primary and fallback database URLs are identical; refusing to sync onto self');
  }

  const dryRun = options.dryRun ?? false;
  const skipLogs = options.skipLogs ?? false;
  const forceFull = options.forceFull ?? false;
  const batchSize = Math.max(10, Math.min(options.batchSize ?? 250, 1000));
  const overlapMinutes = Math.max(1, options.overlapMinutes ?? 60);

  const primaryHandle = createDbHandle(primaryUrl, { max: 2 });
  const fallbackHandle = createDbHandle(fallbackUrl, { max: 4 });
  const warnings: string[] = [];
  const tablesSynced: TableSyncResult[] = [];
  let totalRowsFetched = 0;
  let totalRowsUpserted = 0;

  try {
    const [primaryTables, fallbackTables] = await Promise.all([
      listPublicTables(primaryHandle),
      listPublicTables(fallbackHandle),
    ]);

    for (const spec of SYNC_PLAN) {
      if (options.abortIf?.()) throw new SyncAbortedError();

      if (skipLogs && spec.tableName === 'request_logs') {
        tablesSynced.push({
          tableName: spec.tableName,
          skipped: true,
          skipReason: 'skipLogs=true',
          rowsFetched: 0,
          rowsUpserted: 0,
        });
        continue;
      }

      if (!primaryTables.has(spec.tableName)) {
        warnings.push(`Skipped ${spec.tableName}: missing on primary`);
        tablesSynced.push({
          tableName: spec.tableName,
          skipped: true,
          skipReason: 'missing_on_primary',
          rowsFetched: 0,
          rowsUpserted: 0,
        });
        continue;
      }

      if (!fallbackTables.has(spec.tableName)) {
        warnings.push(`Skipped ${spec.tableName}: missing on fallback (run Drizzle migrations on fallback)`);
        tablesSynced.push({
          tableName: spec.tableName,
          skipped: true,
          skipReason: 'missing_on_fallback',
          rowsFetched: 0,
          rowsUpserted: 0,
        });
        continue;
      }

      const res =
        spec.mode === 'append_watermark' && spec.tsCol && spec.tsColSql
          ? await syncAppendWatermarkTable(
              primaryHandle,
              fallbackHandle,
              spec,
              batchSize,
              overlapMinutes,
              forceFull,
              dryRun,
              options.abortIf,
            )
          : await syncUpsertTable(primaryHandle, fallbackHandle, spec, batchSize, dryRun, options.abortIf);

      totalRowsFetched += res.rowsFetched;
      totalRowsUpserted += res.rowsUpserted;
      tablesSynced.push({
        tableName: spec.tableName,
        skipped: false,
        rowsFetched: res.rowsFetched,
        rowsUpserted: res.rowsUpserted,
      });
    }
  } finally {
    await Promise.all([
      primaryHandle.close().catch(() => {}),
      fallbackHandle.close().catch(() => {}),
    ]);
  }

  const parityAfterSync = await checkDatabaseParity({ primaryUrl, fallbackUrl });

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    dryRun,
    tablesSynced,
    totalRowsFetched,
    totalRowsUpserted,
    warnings,
    parityAfterSync,
  };
}

// ---------------------------------------------------------------------------
// Targeted sync-on-write (payment / redeem)
// ---------------------------------------------------------------------------

export interface TargetedSyncInput {
  userId?: string;
  paymentId?: string;
  redeemCodeId?: string;
}

export interface TargetedSyncOptions {
  primaryUrl?: string;
  fallbackUrl?: string;
  /** Ledger rows newer than this many minutes are copied for the user. Default 60. */
  ledgerWindowMinutes?: number;
  abortIf?: () => boolean;
}

export interface TargetedSyncResult {
  userId: string;
  tables: Array<{ tableName: string; rowsFetched: number; rowsUpserted: number }>;
  totalRowsUpserted: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TARGETED_BATCH = 250;
const TARGETED_LEDGER_CAP = 5000;

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`[db-sync] invalid ${label}: expected a UUID`);
  }
}

async function copyScopedRows(args: {
  primaryDb: any;
  fallbackDb: any;
  table: PgTable;
  tableName: string;
  pkProp: string;
  pkCol: AnyColumn;
  where: SQL;
  mode: 'upsert' | 'insert_ignore';
  orderBy?: SQL[];
  limit?: number;
  abortIf?: () => boolean;
}): Promise<{ tableName: string; rowsFetched: number; rowsUpserted: number }> {
  let query = args.primaryDb.select().from(args.table).where(args.where);
  if (args.orderBy) query = query.orderBy(...args.orderBy);
  if (args.limit) query = query.limit(args.limit);
  const rows: Array<Record<string, unknown>> = await query;

  let rowsUpserted = 0;
  for (let i = 0; i < rows.length; i += TARGETED_BATCH) {
    if (args.abortIf?.()) throw new SyncAbortedError();
    const chunk = rows.slice(i, i + TARGETED_BATCH);
    const insert = args.fallbackDb.insert(args.table).values(chunk);
    if (args.mode === 'upsert') {
      await insert.onConflictDoUpdate({
        target: args.pkCol,
        set: buildConflictUpdateSet(args.table, args.pkProp),
      });
    } else {
      await insert.onConflictDoNothing();
    }
    rowsUpserted += chunk.length;
  }
  return { tableName: args.tableName, rowsFetched: rows.length, rowsUpserted };
}

/**
 * Copies ONLY the rows touched by one payment and/or one redeem from Primary to Fallback.
 * Idempotent (upsert / insert-ignore). Parent rows (packages, models) are NOT copied here:
 * a foreign-key failure throws and the caller escalates to a full sync.
 */
export async function syncTargetedToFallback(
  input: TargetedSyncInput,
  options: TargetedSyncOptions = {},
): Promise<TargetedSyncResult> {
  // 1) Validate everything BEFORE opening any connection.
  if (input.userId) assertUuid(input.userId, 'userId');
  if (input.paymentId) assertUuid(input.paymentId, 'paymentId');
  if (input.redeemCodeId) assertUuid(input.redeemCodeId, 'redeemCodeId');
  if (!input.userId && !input.paymentId) {
    throw new Error('[db-sync] targeted sync needs userId or paymentId');
  }
  const primaryUrl = options.primaryUrl ?? getConnectionString();
  const fallbackUrl = options.fallbackUrl ?? getFallbackConnectionString();
  if (!fallbackUrl) throw new Error('[db-sync] DATABASE_URL_FALLBACK is not configured');
  if (primaryUrl === fallbackUrl) {
    throw new Error('[db-sync] Primary and fallback database URLs are identical; refusing to sync onto self');
  }

  const primaryHandle = createDbHandle(primaryUrl, { max: 2 });
  const fallbackHandle = createDbHandle(fallbackUrl, { max: 2 });
  const primaryDb = primaryHandle.db as any;
  const fallbackDb = fallbackHandle.db as any;
  const abortIf = options.abortIf;
  const tables: TargetedSyncResult['tables'] = [];

  try {
    // 2) Resolve userId (from the payment if needed).
    let userId = input.userId ?? null;
    if (!userId && input.paymentId) {
      const [row] = await primaryDb
        .select({ userId: s.payments.userId })
        .from(s.payments)
        .where(eq(s.payments.id, input.paymentId))
        .limit(1);
      userId = row?.userId ?? null;
    }
    if (!userId) throw new Error('[db-sync] could not resolve userId for targeted sync');

    // 3) Collect redeem-code ids (explicit + gift-card codes minted by this payment).
    const redeemIds = new Set<string>();
    if (input.redeemCodeId) redeemIds.add(input.redeemCodeId);
    if (input.paymentId) {
      const gifts: Array<{ redeemCodeId: string | null }> = await primaryDb
        .select({ redeemCodeId: s.giftCards.redeemCodeId })
        .from(s.giftCards)
        .where(eq(s.giftCards.paymentId, input.paymentId));
      for (const g of gifts) if (g.redeemCodeId) redeemIds.add(g.redeemCodeId);
    }
    const redeemIdList = [...redeemIds];

    const since = new Date(Date.now() - (options.ledgerWindowMinutes ?? 60) * 60_000);
    const common = { primaryDb, fallbackDb, abortIf };

    // 4) Copy in strict foreign-key order.
    tables.push(await copyScopedRows({ ...common, table: s.users, tableName: 'users', pkProp: 'id', pkCol: s.users.id, where: eq(s.users.id, userId), mode: 'upsert' }));
    tables.push(await copyScopedRows({ ...common, table: s.balances, tableName: 'balances', pkProp: 'userId', pkCol: s.balances.userId, where: eq(s.balances.userId, userId), mode: 'upsert' }));
    if (redeemIdList.length > 0) {
      tables.push(await copyScopedRows({ ...common, table: s.redeemCodes, tableName: 'redeem_codes', pkProp: 'id', pkCol: s.redeemCodes.id, where: inArray(s.redeemCodes.id, redeemIdList), mode: 'upsert' }));
    }
    if (input.paymentId) {
      tables.push(await copyScopedRows({ ...common, table: s.payments, tableName: 'payments', pkProp: 'id', pkCol: s.payments.id, where: eq(s.payments.id, input.paymentId), mode: 'upsert' }));
    }
    tables.push(await copyScopedRows({ ...common, table: s.entitlements, tableName: 'entitlements', pkProp: 'id', pkCol: s.entitlements.id, where: eq(s.entitlements.userId, userId), mode: 'upsert' }));
    if (input.paymentId) {
      tables.push(await copyScopedRows({ ...common, table: s.paymentEvents, tableName: 'payment_events', pkProp: 'id', pkCol: s.paymentEvents.id, where: eq(s.paymentEvents.paymentId, input.paymentId), mode: 'insert_ignore' }));
      tables.push(await copyScopedRows({ ...common, table: s.giftCards, tableName: 'gift_cards', pkProp: 'id', pkCol: s.giftCards.id, where: eq(s.giftCards.paymentId, input.paymentId), mode: 'upsert' }));
    }
    if (redeemIdList.length > 0) {
      tables.push(await copyScopedRows({ ...common, table: s.redemptions, tableName: 'redemptions', pkProp: 'id', pkCol: s.redemptions.id, where: and(inArray(s.redemptions.codeId, redeemIdList), eq(s.redemptions.userId, userId))!, mode: 'insert_ignore' }));
    }
    tables.push(await copyScopedRows({ ...common, table: s.creditLedger, tableName: 'credit_ledger', pkProp: 'id', pkCol: s.creditLedger.id, where: and(eq(s.creditLedger.userId, userId), gte(s.creditLedger.createdAt, since))!, mode: 'insert_ignore', orderBy: [asc(s.creditLedger.createdAt), asc(s.creditLedger.id)], limit: TARGETED_LEDGER_CAP }));

    return {
      userId,
      tables,
      totalRowsUpserted: tables.reduce((sum, t) => sum + t.rowsUpserted, 0),
    };
  } finally {
    await Promise.all([primaryHandle.close().catch(() => {}), fallbackHandle.close().catch(() => {})]);
  }
}
