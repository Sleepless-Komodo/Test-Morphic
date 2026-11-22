// Numbered pages for every history list: LIMIT PAGE_SIZE + 1 OFFSET (page - 1) * PAGE_SIZE, plus a
// count that stops at COUNT_CAP so it never scans a whole log table. The extra row only says whether
// a next page exists, which keeps Next working past the capped last page.
// No drizzle or server imports here: client views (dashboard logs) use this module too.

/** Rows per page in every dashboard and admin list. */
export const PAGE_SIZE = 5;
/** The count stops here (200 pages). Past it the last page reads "200+". */
export const COUNT_CAP = 1000;

export interface PageCount {
  total: number;
  capped: boolean;
}

export interface NumberedPage<T> extends PageCount {
  items: T[];
  page: number;
  lastPage: number;
  hasNext: boolean;
}

/** `?page` from searchParams. Anything that is not a whole number from 1 up means page 1. */
export function readPage(raw: string | string[] | undefined | null): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !/^\d+$/.test(v)) return 1;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

export const offsetOf = (page: number) => (page - 1) * PAGE_SIZE;

const lastPageOf = (count: PageCount) => Math.max(1, Math.ceil(count.total / PAGE_SIZE));

export function toNumberedPage<T>(rows: T[], page: number, count: PageCount): NumberedPage<T> {
  return {
    items: rows.slice(0, PAGE_SIZE),
    page,
    lastPage: lastPageOf(count),
    total: count.total,
    capped: count.capped,
    hasNext: rows.length > PAGE_SIZE,
  };
}

/**
 * One page: the row query and the count run together. A page past the end (an old link, a typed
 * URL) comes back empty, so it is read again at the last real page. A capped count does not know the
 * last page, so that case keeps the empty page.
 */
export async function loadPage<T>(
  page: number,
  rows: (offset: number, limit: number) => Promise<T[]>,
  count: () => Promise<PageCount>,
): Promise<NumberedPage<T>> {
  const [first, c] = await Promise.all([rows(offsetOf(page), PAGE_SIZE + 1), count()]);
  const last = lastPageOf(c);
  if (first.length === 0 && page > 1 && !c.capped && page > last) {
    return toNumberedPage(await rows(offsetOf(last), PAGE_SIZE + 1), last, c);
  }
  return toNumberedPage(first, page, c);
}

/** Page numbers to render: 1, the last page and the neighbours of the current one, 'gap' between. */
export function pageWindow(p: Pick<NumberedPage<unknown>, 'page' | 'lastPage' | 'capped' | 'hasNext'>): (number | 'gap')[] {
  const last = Math.max(p.lastPage, p.page);
  if (last === 1 && !p.hasNext) return [];
  const keep = new Set([1, last, p.page - 1, p.page, p.page + 1].filter((n) => n >= 1 && n <= last));
  const out: (number | 'gap')[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev === 2) out.push(n - 1);
    else if (n - prev > 2) out.push('gap');
    out.push(n);
    prev = n;
  }
  return out;
}

/** Row total for a list header: "23", or "1000+" once the count hit its cap. */
export const formatPageTotal = (c: PageCount) => (c.capped ? `${c.total}+` : String(c.total));

/**
 * Latest request wins: a client view that fetches pages (pager clicks, filter changes) wraps each
 * fetch in run(), and only the newest one reports current: true. A slow older answer can then never
 * overwrite newer filters or a reset after router.refresh (call reset() there).
 */
export function latestOnly() {
  let seq = 0;
  return {
    async run<T>(p: Promise<T>): Promise<{ current: true; value: T } | { current: false }> {
      const mine = ++seq;
      try {
        const value = await p;
        return mine === seq ? { current: true, value } : { current: false };
      } catch (err) {
        // A failure only matters while it is still the newest request.
        if (mine === seq) throw err;
        return { current: false };
      }
    },
    reset() {
      seq++;
    },
  };
}

// --- Next/Prev for the growing log lists (client side) ---------------------------------------
// The server hands back an opaque `nextCursor` for the older page. The client keeps the cursors it
// came through, so "Newer" is one step back and the page number is just how deep it went.

export interface KeysetNav {
  /** Cursor the current page was read with; null is the newest page. */
  cursor: string | null;
  /** Cursors of the pages above this one, newest first. */
  back: (string | null)[];
}

export type KeysetMove = 'newest' | 'newer' | 'older';

/** Where a move lands. `older` needs the current page's nextCursor; without one it stays put. */
export function keysetNav(nav: KeysetNav, to: KeysetMove, nextCursor?: string | null): KeysetNav {
  if (to === 'newest') return { cursor: null, back: [] };
  if (to === 'newer') return nav.back.length ? { cursor: nav.back.at(-1) ?? null, back: nav.back.slice(0, -1) } : nav;
  return nextCursor ? { cursor: nextCursor, back: [...nav.back, nav.cursor] } : nav;
}

export const keysetPageNumber = (nav: KeysetNav) => nav.back.length + 1;

// --- Next/Prev through the URL (admin log lists) ---------------------------------------------

/**
 * Links for a server-rendered Newer/Older list. Cursors come from toPageBoth in pagination.ts; `n`
 * only labels the page ("Page 3") and is never trusted for anything else. A page with no Newer page
 * is the newest one, so it is page 1 whatever the URL says.
 */
export function keysetLinks(p: {
  path: string;
  params?: Record<string, string | undefined>;
  n?: string | string[];
  prevCursor: string | null;
  nextCursor: string | null;
}) {
  const page = p.prevCursor ? Math.max(2, readPage(p.n)) : 1;
  const href = (to: KeysetMove) => {
    const q = new URLSearchParams(Object.entries(p.params ?? {}).filter((e): e is [string, string] => !!e[1]));
    if (to === 'older' && p.nextCursor) {
      q.set('before', p.nextCursor);
      q.set('n', String(page + 1));
    } else if (to === 'newer' && p.prevCursor) {
      q.set('after', p.prevCursor);
      q.set('n', String(page - 1));
    }
    const qs = q.toString();
    return qs ? `${p.path}?${qs}` : p.path;
  };
  return { page, hasNewer: !!p.prevCursor, hasOlder: !!p.nextCursor, href };
}
