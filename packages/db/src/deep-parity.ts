import { createHash } from 'node:crypto';
import { asc, getTableColumns, gt, sql } from 'drizzle-orm';
import { createDbHandle, extractExecuteRows, getConnectionString, getFallbackConnectionString, type DbHandle } from './index.ts';
import { SYNC_PLAN, type TableSyncSpec } from './sync.ts';

export const DEEP_PARITY_TABLES: readonly string[] = [
  'users',
  'balances',
  'credit_ledger',
  'payments',
  'payment_events',
  'entitlements',
  'reservations',
  'usage_records',
  'redeem_codes',
  'redemptions',
  'gift_cards',
  'api_keys',
  'packages',
  'models',
  'providers',
  'model_provider_pool',
];

const PAGE = 500;
const MAX_LISTED = 20;

export interface DeepTableResult {
  tableName: string;
  primaryRows: number;
  fallbackRows: number;
  missingOnPrimary: number;
  missingOnFallback: number;
  different: number;
  /** Primary keys only, capped. Row contents and hashes are never reported. */
  samplePks: string[];
  matches: boolean;
}

export interface LedgerCheck {
  usersWithMismatch: number;
  totalMismatchCredits: number;
}

export interface DeepParityReport {
  checkedAt: string;
  matches: boolean;
  tables: DeepTableResult[];
  ledgerPrimary: LedgerCheck;
  ledgerFallback: LedgerCheck;
  /** Users whose balance-vs-ledger difference is not the same on both sides. */
  ledgerDifferences: string[];
}

function canonical(value: unknown): unknown {
  // Sync copies timestamps through Date, so microseconds are not comparable.
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(rec).sort().map((k) => [k, canonical(rec[k])]));
  }
  return value;
}

async function hashTable(handle: DbHandle, spec: TableSyncSpec): Promise<Map<string, string>> {
  const db = handle.db as any;
  const props = Object.keys(getTableColumns(spec.table)).sort();
  const out = new Map<string, string>();
  let lastPk: unknown = null;
  while (true) {
    const base = db.select().from(spec.table);
    const rows: Array<Record<string, unknown>> = await (lastPk === null ? base : base.where(gt(spec.pkCol, lastPk)))
      .orderBy(asc(spec.pkCol))
      .limit(PAGE);
    for (const row of rows) {
      const body = JSON.stringify(props.map((p) => canonical(row[p])));
      out.set(String(row[spec.pkProp]), createHash('sha256').update(body).digest('base64'));
    }
    if (rows.length < PAGE) return out;
    lastPk = rows[rows.length - 1]![spec.pkProp];
  }
}

/** Per-user `balances.credits - sum(balance ledger)`, non-zero entries only. Read-only. */
async function ledgerMismatches(handle: DbHandle): Promise<Map<string, number>> {
  const rows = extractExecuteRows<{ user_id: string; diff: string | number }>(
    await handle.db.execute(sql`
      SELECT coalesce(b.user_id, l.user_id)::text AS user_id,
             (coalesce(b.credits, 0) - coalesce(l.total, 0))::bigint AS diff
      FROM public.balances b
      FULL OUTER JOIN (
        SELECT user_id, sum(amount) AS total FROM public.credit_ledger
        WHERE source_type = 'balance' GROUP BY user_id
      ) l ON l.user_id = b.user_id
      WHERE coalesce(b.credits, 0) <> coalesce(l.total, 0)
    `),
  );
  return new Map(rows.map((r) => [r.user_id, Number(r.diff)]));
}

const summarizeLedger = (m: Map<string, number>): LedgerCheck => ({
  usersWithMismatch: m.size,
  totalMismatchCredits: [...m.values()].reduce((a, b) => a + Math.abs(b), 0),
});

/**
 * Compares row contents, not just counts. Only meaningful while nothing writes to either database.
 */
export async function checkDeepParity(options: {
  primaryUrl?: string;
  fallbackUrl?: string;
  tables?: readonly string[];
} = {}): Promise<DeepParityReport> {
  const primaryUrl = options.primaryUrl ?? getConnectionString();
  const fallbackUrl = options.fallbackUrl ?? getFallbackConnectionString();
  if (!fallbackUrl) throw new Error('[db-parity] DATABASE_URL_FALLBACK is not configured');
  if (primaryUrl === fallbackUrl) throw new Error('[db-parity] Primary and fallback database URLs are identical');

  const primary = createDbHandle(primaryUrl, { max: 2 });
  const fallback = createDbHandle(fallbackUrl, { max: 2 });
  try {
    const tables: DeepTableResult[] = [];
    for (const tableName of options.tables ?? DEEP_PARITY_TABLES) {
      const spec = SYNC_PLAN.find((t) => t.tableName === tableName);
      if (!spec) throw new Error(`[db-parity] unknown table ${tableName}`);
      const [p, f] = await Promise.all([hashTable(primary, spec), hashTable(fallback, spec)]);
      const missingOnFallback = [...p.keys()].filter((k) => !f.has(k));
      const missingOnPrimary = [...f.keys()].filter((k) => !p.has(k));
      const different = [...p.keys()].filter((k) => f.has(k) && f.get(k) !== p.get(k));
      tables.push({
        tableName,
        primaryRows: p.size,
        fallbackRows: f.size,
        missingOnPrimary: missingOnPrimary.length,
        missingOnFallback: missingOnFallback.length,
        different: different.length,
        samplePks: [...different, ...missingOnPrimary, ...missingOnFallback].slice(0, MAX_LISTED),
        matches: missingOnPrimary.length + missingOnFallback.length + different.length === 0,
      });
    }

    const [lp, lf] = await Promise.all([ledgerMismatches(primary), ledgerMismatches(fallback)]);
    const ledgerDifferences = [...new Set([...lp.keys(), ...lf.keys()])].filter((u) => lp.get(u) !== lf.get(u));
    return {
      checkedAt: new Date().toISOString(),
      matches: tables.every((t) => t.matches) && ledgerDifferences.length === 0,
      tables,
      ledgerPrimary: summarizeLedger(lp),
      ledgerFallback: summarizeLedger(lf),
      ledgerDifferences: ledgerDifferences.slice(0, MAX_LISTED),
    };
  } finally {
    await Promise.all([primary.close().catch(() => {}), fallback.close().catch(() => {})]);
  }
}

export function formatDeepParityCli(report: DeepParityReport): string {
  const lines = [
    `Deep parity (row contents) at ${report.checkedAt}`,
    'Only valid while the web is in maintenance and the API is stopped.',
    '',
  ];
  for (const t of report.tables) {
    const status = t.matches
      ? 'MATCH'
      : `DIFF missingOnPrimary=${t.missingOnPrimary} missingOnFallback=${t.missingOnFallback} different=${t.different}`;
    lines.push(` ${t.tableName.padEnd(22)} primary=${String(t.primaryRows).padStart(6)} fallback=${String(t.fallbackRows).padStart(6)}  ${status}`);
    for (const pk of t.samplePks) lines.push(`     ${pk}`);
  }
  lines.push(
    '',
    ` Balance vs ledger: primary ${report.ledgerPrimary.usersWithMismatch} user(s), ${report.ledgerPrimary.totalMismatchCredits} cr; ` +
      `fallback ${report.ledgerFallback.usersWithMismatch} user(s), ${report.ledgerFallback.totalMismatchCredits} cr`,
  );
  if (report.ledgerDifferences.length > 0) {
    lines.push(` Ledger differs between databases for: ${report.ledgerDifferences.join(', ')}`);
  }
  lines.push(` Verdict: ${report.matches ? 'MATCH' : 'DIFFERENT - do not switch databases'}`);
  return lines.join('\n');
}
