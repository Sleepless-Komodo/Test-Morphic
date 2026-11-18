import { sql } from 'drizzle-orm';
import {
  createDbHandle,
  extractExecuteRows,
  getConnectionString,
  getFallbackConnectionString,
  sanitizeErrorForLog,
  type DbHandle,
} from './index.ts';

export type TableCategory = 'critical' | 'catalog' | 'operational';

export interface ParityTableMeta {
  tableName: string;
  category: TableCategory;
  timestampColumn: 'created_at' | 'updated_at' | 'published_at' | 'last_run_at' | null;
}

/**
 * Hardcoded allowlist of all 26 application tables in `packages/db/src/schema.ts`.
 * Used strictly as static identifiers in SQL inspection queries.
 */
export const PARITY_TABLES: readonly ParityTableMeta[] = [
  // Critical Financial & Auth Tables
  { tableName: 'users', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'accounts', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'two_factor', category: 'critical', timestampColumn: null },
  { tableName: 'api_keys', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'balances', category: 'critical', timestampColumn: 'updated_at' },
  { tableName: 'credit_ledger', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'reservations', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'packages', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'entitlements', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'payments', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'payment_events', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'redeem_codes', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'redemptions', category: 'critical', timestampColumn: 'created_at' },
  { tableName: 'gift_cards', category: 'critical', timestampColumn: 'created_at' },

  // Catalog & Config Tables
  { tableName: 'providers', category: 'catalog', timestampColumn: 'created_at' },
  { tableName: 'models', category: 'catalog', timestampColumn: 'created_at' },
  { tableName: 'model_provider_pool', category: 'catalog', timestampColumn: 'created_at' },
  { tableName: 'announcements', category: 'catalog', timestampColumn: 'published_at' },

  // Operational & Audit Tables
  { tableName: 'usage_records', category: 'operational', timestampColumn: 'created_at' },
  { tableName: 'request_logs', category: 'operational', timestampColumn: 'created_at' },
  { tableName: 'admin_audit_log', category: 'operational', timestampColumn: 'created_at' },
  { tableName: 'dsar_requests', category: 'operational', timestampColumn: 'created_at' },
  { tableName: 'abuse_cases', category: 'operational', timestampColumn: 'created_at' },
  { tableName: 'sessions', category: 'operational', timestampColumn: 'created_at' },
  { tableName: 'verifications', category: 'operational', timestampColumn: 'created_at' },
  { tableName: 'job_leases', category: 'operational', timestampColumn: 'last_run_at' },
] as const;

export interface TableParityEntry {
  tableName: string;
  category: TableCategory;
  existsOnPrimary: boolean;
  existsOnFallback: boolean;
  primaryCount: number;
  fallbackCount: number;
  deltaRows: number; // primaryCount - fallbackCount
  primaryLatestAt: string | null;
  fallbackLatestAt: string | null;
  lagSeconds: number | null;
  matches: boolean;
}

export interface UserBalanceDiff {
  userId: string;
  email: string;
  primaryCredits: number;
  fallbackCredits: number;
  deltaCredits: number;
}

export interface DatabaseParityReport {
  checkedAt: string;
  primaryHost: string;
  fallbackHost: string;
  primaryReachable: boolean;
  fallbackReachable: boolean;
  fallbackPermissionsOk: boolean;
  migrationsMatch: boolean;
  primaryMigrationsCount: number;
  fallbackMigrationsCount: number;
  isCriticalMatch: boolean;
  isExactMatch: boolean;
  maxLagSeconds: number | null;
  tables: TableParityEntry[];
  driftedTables: TableParityEntry[];
  financialDiff: {
    totalPrimaryBalanceCredits: number;
    totalFallbackBalanceCredits: number;
    balanceDeltaCredits: number;
    mismatchedUserBalances: UserBalanceDiff[];
    paidPaymentsPrimary: number;
    paidPaymentsFallback: number;
    paidAmountCentsPrimary: number;
    paidAmountCentsFallback: number;
    ledgerEntriesPrimary: number;
    ledgerEntriesFallback: number;
    activeApiKeysPrimary: number;
    activeApiKeysFallback: number;
  };
  warnings: string[];
}

export interface DbSnapshot {
  reachable: boolean;
  permissionsOk: boolean;
  migrationsCount: number;
  latestMigrationHash: string | null;
  tables: Record<
    string,
    {
      exists: boolean;
      count: number;
      latestAt: string | null;
    }
  >;
  userBalances: Array<{
    userId: string;
    email: string;
    credits: number;
  }>;
  paidPaymentsCount: number;
  paidAmountCents: number;
  activeApiKeysCount: number;
  error?: string;
}

const EPHEMERAL_EXACT_EXEMPT_TABLES = new Set(['job_leases', 'sessions']);

export function safeHostLabel(connectionString: string | null | undefined): string {
  if (!connectionString) return '(unset)';
  try {
    const u = new URL(connectionString);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return '(invalid-url)';
  }
}

function emptySnapshot(error?: string): DbSnapshot {
  return {
    reachable: false,
    permissionsOk: false,
    migrationsCount: 0,
    latestMigrationHash: null,
    tables: {},
    userBalances: [],
    paidPaymentsCount: 0,
    paidAmountCents: 0,
    activeApiKeysCount: 0,
    error,
  };
}

export async function checkConnectivityAndGrants(handle: DbHandle): Promise<{
  reachable: boolean;
  database: string | null;
  user: string | null;
  permissionsOk: boolean;
  error?: string;
}> {
  try {
    const identityRows = extractExecuteRows<{ db_name: string; db_user: string }>(
      await handle.db.execute(sql`SELECT current_database() AS db_name, current_user AS db_user`),
    );
    const identity = identityRows[0];

    const privRows = extractExecuteRows<{
      schema_usage: boolean;
      users_priv: boolean;
    }>(
      await handle.db.execute(sql`
        SELECT
          has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
          CASE
            WHEN to_regclass('public.users') IS NOT NULL
            THEN has_table_privilege(current_user, 'public.users', 'SELECT, INSERT, UPDATE, DELETE')
            ELSE true
          END AS users_priv
      `),
    );
    const priv = privRows[0];
    const permissionsOk = Boolean(priv?.schema_usage && priv?.users_priv);

    return {
      reachable: true,
      database: identity?.db_name ?? null,
      user: identity?.db_user ?? null,
      permissionsOk,
    };
  } catch (err) {
    return {
      reachable: false,
      database: null,
      user: null,
      permissionsOk: false,
      error: sanitizeErrorForLog(err),
    };
  }
}

async function collectDbSnapshot(connectionString: string | null): Promise<DbSnapshot> {
  if (!connectionString) {
    return emptySnapshot('Connection string not configured');
  }

  const handle = createDbHandle(connectionString, { max: 2 });
  try {
    const conn = await checkConnectivityAndGrants(handle);
    if (!conn.reachable) {
      return emptySnapshot(conn.error ?? 'Unreachable');
    }

    let migrationsCount = 0;
    let latestMigrationHash: string | null = null;
    try {
      const migRows = extractExecuteRows<{ cnt: number; latest_hash: string | null }>(
        await handle.db.execute(sql`
          SELECT
            count(*)::int AS cnt,
            (SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC, id DESC LIMIT 1) AS latest_hash
          FROM drizzle.__drizzle_migrations
        `),
      );
      migrationsCount = Number(migRows[0]?.cnt ?? 0);
      latestMigrationHash = migRows[0]?.latest_hash ?? null;
    } catch {
      migrationsCount = 0;
      latestMigrationHash = null;
    }

    const existingRows = extractExecuteRows<{ table_name: string }>(
      await handle.db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `),
    );
    const existingSet = new Set(existingRows.map((r) => r.table_name));

    const tables: DbSnapshot['tables'] = {};
    for (const meta of PARITY_TABLES) {
      if (!existingSet.has(meta.tableName)) {
        tables[meta.tableName] = { exists: false, count: 0, latestAt: null };
        continue;
      }

      const query = meta.timestampColumn
        ? sql.raw(
            `SELECT count(*)::bigint AS cnt, max("${meta.timestampColumn}")::text AS latest_at FROM "public"."${meta.tableName}"`,
          )
        : sql.raw(
            `SELECT count(*)::bigint AS cnt, NULL::text AS latest_at FROM "public"."${meta.tableName}"`,
          );

      const rows = extractExecuteRows<{ cnt: string | number; latest_at: string | null }>(
        await handle.db.execute(query),
      );
      tables[meta.tableName] = {
        exists: true,
        count: Number(rows[0]?.cnt ?? 0),
        latestAt: rows[0]?.latest_at ?? null,
      };
    }

    let userBalances: DbSnapshot['userBalances'] = [];
    if (existingSet.has('users') && existingSet.has('balances')) {
      const balRows = extractExecuteRows<{
        user_id: string;
        email: string;
        credits: string | number;
      }>(
        await handle.db.execute(sql`
          SELECT
            u.id::text AS user_id,
            u.email,
            coalesce(b.credits, 0)::bigint AS credits
          FROM public.users u
          LEFT JOIN public.balances b ON b.user_id = u.id
        `),
      );
      userBalances = balRows.map((r) => ({
        userId: r.user_id,
        email: r.email,
        credits: Number(r.credits ?? 0),
      }));
    }

    let paidPaymentsCount = 0;
    let paidAmountCents = 0;
    if (existingSet.has('payments')) {
      const payRows = extractExecuteRows<{ paid_count: string | number; paid_cents: string | number }>(
        await handle.db.execute(sql`
          SELECT
            count(*)::bigint AS paid_count,
            coalesce(sum(amount_cents), 0)::bigint AS paid_cents
          FROM public.payments
          WHERE status = 'paid'
        `),
      );
      paidPaymentsCount = Number(payRows[0]?.paid_count ?? 0);
      paidAmountCents = Number(payRows[0]?.paid_cents ?? 0);
    }

    let activeApiKeysCount = 0;
    if (existingSet.has('api_keys')) {
      const keyRows = extractExecuteRows<{ active_keys: string | number }>(
        await handle.db.execute(sql`
          SELECT count(*)::bigint AS active_keys
          FROM public.api_keys
          WHERE status = 'active'
        `),
      );
      activeApiKeysCount = Number(keyRows[0]?.active_keys ?? 0);
    }

    return {
      reachable: true,
      permissionsOk: conn.permissionsOk,
      migrationsCount,
      latestMigrationHash,
      tables,
      userBalances,
      paidPaymentsCount,
      paidAmountCents,
      activeApiKeysCount,
    };
  } catch (err) {
    return emptySnapshot(sanitizeErrorForLog(err));
  } finally {
    await handle.close().catch(() => {});
  }
}

function computeLagSeconds(primaryIso: string | null, fallbackIso: string | null): number | null {
  if (!primaryIso || !fallbackIso) return null;
  const pMs = Date.parse(primaryIso);
  const fMs = Date.parse(fallbackIso);
  if (!Number.isFinite(pMs) || !Number.isFinite(fMs)) return null;
  return Math.max(0, Math.round((pMs - fMs) / 1000));
}

export function computeParityDiffFromSnapshots(
  primarySnap: DbSnapshot,
  fallbackSnap: DbSnapshot,
  meta?: { primaryHost?: string; fallbackHost?: string; checkedAt?: string },
): DatabaseParityReport {
  const warnings: string[] = [];
  if (!primarySnap.reachable) {
    warnings.push(`Primary database unreachable: ${primarySnap.error ?? 'unknown error'}`);
  }
  if (!fallbackSnap.reachable) {
    warnings.push(`Fallback database unreachable: ${fallbackSnap.error ?? 'unknown error'}`);
  }
  if (fallbackSnap.reachable && !fallbackSnap.permissionsOk) {
    warnings.push('Fallback role lacks required schema USAGE or table CRUD grants on public.users');
  }

  const migrationsMatch =
    primarySnap.reachable &&
    fallbackSnap.reachable &&
    primarySnap.migrationsCount === fallbackSnap.migrationsCount &&
    (primarySnap.migrationsCount === 0 ||
      primarySnap.latestMigrationHash === fallbackSnap.latestMigrationHash);

  if (primarySnap.reachable && fallbackSnap.reachable && !migrationsMatch) {
    warnings.push(
      `Drizzle migration mismatch: primary=${primarySnap.migrationsCount} (${primarySnap.latestMigrationHash ?? 'none'}), fallback=${fallbackSnap.migrationsCount} (${fallbackSnap.latestMigrationHash ?? 'none'})`,
    );
  }

  // User balance comparison
  const primaryBalMap = new Map<string, { email: string; credits: number }>();
  for (const row of primarySnap.userBalances) {
    primaryBalMap.set(row.userId, { email: row.email, credits: row.credits });
  }
  const fallbackBalMap = new Map<string, { email: string; credits: number }>();
  for (const row of fallbackSnap.userBalances) {
    fallbackBalMap.set(row.userId, { email: row.email, credits: row.credits });
  }

  const allUserIds = new Set<string>([...primaryBalMap.keys(), ...fallbackBalMap.keys()]);
  const mismatchedUserBalances: UserBalanceDiff[] = [];
  let totalPrimaryBalanceCredits = 0;
  let totalFallbackBalanceCredits = 0;

  for (const userId of allUserIds) {
    const p = primaryBalMap.get(userId);
    const f = fallbackBalMap.get(userId);
    const pCredits = p?.credits ?? 0;
    const fCredits = f?.credits ?? 0;
    totalPrimaryBalanceCredits += pCredits;
    totalFallbackBalanceCredits += fCredits;
    if (pCredits !== fCredits) {
      mismatchedUserBalances.push({
        userId,
        email: p?.email ?? f?.email ?? 'unknown',
        primaryCredits: pCredits,
        fallbackCredits: fCredits,
        deltaCredits: pCredits - fCredits,
      });
    }
  }
  mismatchedUserBalances.sort((a, b) => Math.abs(b.deltaCredits) - Math.abs(a.deltaCredits));

  const balanceDeltaCredits = totalPrimaryBalanceCredits - totalFallbackBalanceCredits;

  const tables: TableParityEntry[] = [];
  let maxLagSeconds: number | null = null;

  for (const tableMeta of PARITY_TABLES) {
    const p = primarySnap.tables[tableMeta.tableName] ?? { exists: false, count: 0, latestAt: null };
    const f = fallbackSnap.tables[tableMeta.tableName] ?? { exists: false, count: 0, latestAt: null };
    const deltaRows = p.count - f.count;
    const lagSeconds = computeLagSeconds(p.latestAt, f.latestAt);

    if (lagSeconds !== null) {
      maxLagSeconds = maxLagSeconds === null ? lagSeconds : Math.max(maxLagSeconds, lagSeconds);
    }

    let matches = p.exists && f.exists && deltaRows === 0;
    if (tableMeta.tableName === 'balances') {
      matches = matches && balanceDeltaCredits === 0 && mismatchedUserBalances.length === 0;
    }

    tables.push({
      tableName: tableMeta.tableName,
      category: tableMeta.category,
      existsOnPrimary: p.exists,
      existsOnFallback: f.exists,
      primaryCount: p.count,
      fallbackCount: f.count,
      deltaRows,
      primaryLatestAt: p.latestAt,
      fallbackLatestAt: f.latestAt,
      lagSeconds,
      matches,
    });
  }

  const driftedTables = tables.filter((t) => !t.matches);

  const ledgerPrimary = primarySnap.tables.credit_ledger?.count ?? 0;
  const ledgerFallback = fallbackSnap.tables.credit_ledger?.count ?? 0;

  const financialMatch =
    balanceDeltaCredits === 0 &&
    mismatchedUserBalances.length === 0 &&
    primarySnap.paidPaymentsCount === fallbackSnap.paidPaymentsCount &&
    primarySnap.paidAmountCents === fallbackSnap.paidAmountCents &&
    primarySnap.activeApiKeysCount === fallbackSnap.activeApiKeysCount;

  const criticalTablesMatch = tables
    .filter((t) => t.category === 'critical' || t.category === 'catalog')
    .every((t) => t.matches);

  const nonEphemeralOperationalMatch = tables
    .filter((t) => t.category === 'operational' && !EPHEMERAL_EXACT_EXEMPT_TABLES.has(t.tableName))
    .every((t) => t.matches);

  const isCriticalMatch =
    primarySnap.reachable &&
    fallbackSnap.reachable &&
    fallbackSnap.permissionsOk &&
    migrationsMatch &&
    criticalTablesMatch &&
    financialMatch;

  const isExactMatch = isCriticalMatch && nonEphemeralOperationalMatch;

  return {
    checkedAt: meta?.checkedAt ?? new Date().toISOString(),
    primaryHost: meta?.primaryHost ?? '(primary)',
    fallbackHost: meta?.fallbackHost ?? '(fallback)',
    primaryReachable: primarySnap.reachable,
    fallbackReachable: fallbackSnap.reachable,
    fallbackPermissionsOk: fallbackSnap.permissionsOk,
    migrationsMatch,
    primaryMigrationsCount: primarySnap.migrationsCount,
    fallbackMigrationsCount: fallbackSnap.migrationsCount,
    isCriticalMatch,
    isExactMatch,
    maxLagSeconds,
    tables,
    driftedTables,
    financialDiff: {
      totalPrimaryBalanceCredits,
      totalFallbackBalanceCredits,
      balanceDeltaCredits,
      mismatchedUserBalances,
      paidPaymentsPrimary: primarySnap.paidPaymentsCount,
      paidPaymentsFallback: fallbackSnap.paidPaymentsCount,
      paidAmountCentsPrimary: primarySnap.paidAmountCents,
      paidAmountCentsFallback: fallbackSnap.paidAmountCents,
      ledgerEntriesPrimary: ledgerPrimary,
      ledgerEntriesFallback: ledgerFallback,
      activeApiKeysPrimary: primarySnap.activeApiKeysCount,
      activeApiKeysFallback: fallbackSnap.activeApiKeysCount,
    },
    warnings,
  };
}

/**
 * Inspects Primary (`DATABASE_URL`) and Fallback (`DATABASE_URL_FALLBACK`) PostgreSQL instances
 * and computes a full schema, migration, row-count, lag, and financial parity report.
 */
export async function checkDatabaseParity(options?: {
  primaryUrl?: string;
  fallbackUrl?: string;
}): Promise<DatabaseParityReport> {
  const primaryUrl = options?.primaryUrl ?? getConnectionString();
  const fallbackUrl = options?.fallbackUrl ?? getFallbackConnectionString();

  const [primarySnap, fallbackSnap] = await Promise.all([
    collectDbSnapshot(primaryUrl),
    collectDbSnapshot(fallbackUrl),
  ]);

  return computeParityDiffFromSnapshots(primarySnap, fallbackSnap, {
    primaryHost: safeHostLabel(primaryUrl),
    fallbackHost: safeHostLabel(fallbackUrl),
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatParityReportCli(report: DatabaseParityReport): string {
  const lines: string[] = [];
  lines.push('=====================================================================');
  lines.push(' Morphic Database Parity Report (Primary vs Local Fallback)');
  lines.push('=====================================================================');
  lines.push(` Checked At:    ${report.checkedAt}`);
  lines.push(` Primary Host:  ${report.primaryHost} (${report.primaryReachable ? 'ONLINE' : 'UNREACHABLE'})`);
  lines.push(
    ` Fallback Host: ${report.fallbackHost} (${report.fallbackReachable ? 'ONLINE' : 'UNREACHABLE'}, perms=${report.fallbackPermissionsOk ? 'OK' : 'MISSING'})`,
  );
  lines.push(
    ` Migrations:    ${report.migrationsMatch ? 'MATCH' : 'MISMATCH'} (primary=${report.primaryMigrationsCount}, fallback=${report.fallbackMigrationsCount})`,
  );
  lines.push(` Max Data Lag:  ${formatDuration(report.maxLagSeconds)}`);
  lines.push(
    ` Verdict:       ${
      report.isExactMatch
        ? 'EXACT MATCH (100%)'
        : report.isCriticalMatch
          ? 'CRITICAL MATCH (only operational/log tables differ)'
          : 'DRIFT DETECTED (sync required)'
    }`,
  );
  lines.push('');

  lines.push(' Financial & Auth Integrity:');
  lines.push(
    `  - Total Credits Balance: primary=${report.financialDiff.totalPrimaryBalanceCredits}, fallback=${report.financialDiff.totalFallbackBalanceCredits}, delta=${report.financialDiff.balanceDeltaCredits}`,
  );
  lines.push(
    `  - Paid Payments:         primary=${report.financialDiff.paidPaymentsPrimary} (${report.financialDiff.paidAmountCentsPrimary} minor), fallback=${report.financialDiff.paidPaymentsFallback} (${report.financialDiff.paidAmountCentsFallback} minor)`,
  );
  lines.push(
    `  - Credit Ledger Entries: primary=${report.financialDiff.ledgerEntriesPrimary}, fallback=${report.financialDiff.ledgerEntriesFallback}`,
  );
  lines.push(
    `  - Active API Keys:       primary=${report.financialDiff.activeApiKeysPrimary}, fallback=${report.financialDiff.activeApiKeysFallback}`,
  );

  if (report.financialDiff.mismatchedUserBalances.length > 0) {
    lines.push('');
    lines.push(` User Balance Mismatches (${report.financialDiff.mismatchedUserBalances.length}):`);
    for (const u of report.financialDiff.mismatchedUserBalances.slice(0, 15)) {
      lines.push(
        `  * ${u.email} (${u.userId}): primary=${u.primaryCredits}, fallback=${u.fallbackCredits}, delta=${u.deltaCredits}`,
      );
    }
    if (report.financialDiff.mismatchedUserBalances.length > 15) {
      lines.push(`  ... and ${report.financialDiff.mismatchedUserBalances.length - 15} more`);
    }
  }

  lines.push('');
  lines.push(
    ` ${'Table'.padEnd(24)} ${'Category'.padEnd(12)} ${'Primary'.padStart(9)} ${'Fallback'.padStart(9)} ${'Delta'.padStart(8)} ${'Lag'.padStart(9)}  Status`,
  );
  lines.push(` ${'-'.repeat(80)}`);
  for (const t of report.tables) {
    const status = !t.existsOnPrimary || !t.existsOnFallback ? 'MISSING_TBL' : t.matches ? 'MATCH' : 'DRIFT';
    lines.push(
      ` ${t.tableName.padEnd(24)} ${t.category.padEnd(12)} ${String(t.primaryCount).padStart(9)} ${String(t.fallbackCount).padStart(9)} ${String(t.deltaRows).padStart(8)} ${formatDuration(t.lagSeconds).padStart(9)}  ${status}`,
    );
  }

  if (report.warnings.length > 0) {
    lines.push('');
    lines.push(' Warnings:');
    for (const w of report.warnings) {
      lines.push(`  ! ${w}`);
    }
  }
  lines.push('=====================================================================');
  return lines.join('\n');
}

export function formatParitySummaryAlert(report: DatabaseParityReport | null): string {
  if (!report) {
    return 'Parity status unavailable (primary Neon unreachable before baseline check).';
  }
  if (!report.primaryReachable) {
    return `Primary unreachable during parity check (last fallback status: ${report.fallbackReachable ? 'online' : 'unreachable'}).`;
  }
  if (report.isExactMatch) {
    return '100% EXACT MATCH (all critical, catalog, and operational tables synced).';
  }
  if (report.isCriticalMatch) {
    const opsDrifted = report.driftedTables.map((t) => `${t.tableName}(Δ${t.deltaRows})`).join(', ');
    return `CRITICAL MATCH (balances/payments/auth match; log/ops delta: ${opsDrifted || 'none'}).`;
  }
  const topDrifted = report.driftedTables
    .slice(0, 6)
    .map((t) => `${t.tableName}:Δ${t.deltaRows}`)
    .join(', ');
  return `DRIFT DETECTED (lag=${formatDuration(report.maxLagSeconds)}, balanceΔ=${report.financialDiff.balanceDeltaCredits}, paidPayments=${report.financialDiff.paidPaymentsPrimary}/${report.financialDiff.paidPaymentsFallback}, drifted=[${topDrifted}]).`;
}
