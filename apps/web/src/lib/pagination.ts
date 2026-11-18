// Keyset pagination shared by every history list. One indexed query per page and no count(*):
// fetch PAGE_SIZE + 1 rows, show PAGE_SIZE, and the extra row only says whether an older page exists.
// Cursors carry created_at as Postgres text, so microseconds survive the round trip (a JS Date keeps
// milliseconds only, which can skip or repeat rows created in the same millisecond).
import { asc, desc, sql, type SQL, type AnyColumn } from 'drizzle-orm';

/** Cards and widgets that preview a few recent rows. */
export const PREVIEW_LIMIT = 5;
/** Rows per page in every dashboard and admin list. Kept small on purpose: each page is one cheap query. */
export const PAGE_SIZE = 5;

// Every keyset-paginated table uses uuid primary keys; anything else in a cursor is tampering.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Cursor {
  at: string;
  id: string;
}

/** created_at as exact Postgres text, for building the next cursor. Select it next to the row. */
export const cursorAt = (createdAt: AnyColumn) => sql<string>`${createdAt}::text`;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.at}|${c.id}`).toString('base64url');
}

/** null for a missing, malformed or tampered cursor, which means "start from the newest". */
export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const [at, id] = Buffer.from(raw, 'base64url').toString().split('|');
    if (!at || !id || !UUID.test(id) || Number.isNaN(Date.parse(at))) return null;
    return { at, id };
  } catch {
    return null;
  }
}

/** Rows strictly older than the cursor, newest-first order: pair with ORDER BY created_at DESC, id DESC. */
export function olderThan(createdAt: AnyColumn, id: AnyColumn, c: Cursor | null): SQL | undefined {
  return c ? sql`(${createdAt}, ${id}) < (${c.at}::timestamptz, ${c.id})` : undefined;
}

/** Trim the lookahead row and build the cursor for the next page. */
export function toPage<T extends { id: string; cursorAt: string }>(rows: T[], size = PAGE_SIZE) {
  const items = rows.slice(0, size);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > size && last ? encodeCursor({ at: last.cursorAt, id: last.id }) : null,
  };
}

// --- Next/Prev through the URL (admin lists) -------------------------------------------------
// ?before=<cursor> is the next (older) page, ?after=<cursor> the previous (newer) one. Going back
// reads the rows just above the cursor in ascending order and flips them, so Prev is one page back
// and still a single LIMIT n+1 query.

export interface PageRequest {
  cursor: Cursor | null;
  dir: 'older' | 'newer';
}

/** Read ?before / ?after from a page's searchParams. A bad cursor falls back to the newest page. */
export function readPageRequest(sp: { before?: string | string[]; after?: string | string[] } | undefined): PageRequest {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const after = decodeCursor(one(sp?.after));
  if (after) return { cursor: after, dir: 'newer' };
  return { cursor: decodeCursor(one(sp?.before)), dir: 'older' };
}

/** WHERE and ORDER BY for one page. Use with .limit(PAGE_SIZE + 1) and pass the rows to toPageBoth. */
export function keyset(createdAt: AnyColumn, id: AnyColumn, req: PageRequest): { where: SQL | undefined; orderBy: SQL[] } {
  if (req.dir === 'newer' && req.cursor) {
    return { where: sql`(${createdAt}, ${id}) > (${req.cursor.at}::timestamptz, ${req.cursor.id})`, orderBy: [asc(createdAt), asc(id)] };
  }
  return { where: olderThan(createdAt, id, req.cursor), orderBy: [desc(createdAt), desc(id)] };
}

/** Newest-first rows for display, plus the cursors for the Prev and Next links (null = no such page). */
export function toPageBoth<T extends { id: string; cursorAt: string }>(rows: T[], req: PageRequest, size = PAGE_SIZE) {
  const more = rows.length > size;
  const cut = rows.slice(0, size);
  const items = req.dir === 'newer' ? cut.reverse() : cut;
  const enc = (r: T | undefined) => (r ? encodeCursor({ at: r.cursorAt, id: r.id }) : null);
  if (req.dir === 'newer' && req.cursor) {
    // Came back from an older page, so an older page exists; a newer one only if the lookahead hit.
    return { items, prevCursor: more ? enc(items[0]) : null, nextCursor: enc(items.at(-1)) };
  }
  return { items, prevCursor: req.cursor ? enc(items[0]) : null, nextCursor: more ? enc(items.at(-1)) : null };
}
