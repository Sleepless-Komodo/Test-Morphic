import { count } from 'drizzle-orm';
import type { PgSelect } from 'drizzle-orm/pg-core';
import { db } from '@morphic/db';
import { COUNT_CAP, type PageCount } from './page-numbers.ts';

/**
 * Row count for numbered pages, stopping at COUNT_CAP + 1 so a big log table is never scanned in
 * full. Pass the list's own select (joins and WHERE included, one cheap column is enough) with
 * .$dynamic(), and without ORDER BY or LIMIT.
 */
export async function cappedCount(base: PgSelect): Promise<PageCount> {
  const [row] = await db.select({ n: count() }).from(base.limit(COUNT_CAP + 1).as('capped'));
  const n = Number(row?.n ?? 0);
  return { total: Math.min(n, COUNT_CAP), capped: n > COUNT_CAP };
}
