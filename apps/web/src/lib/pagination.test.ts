import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCursor, encodeCursor, toPage } from './pagination.ts';

const id = '3f2b8c1e-6d4a-4b7e-9c21-0a5d8e7f1b23';
const at = '2026-11-18 08:30:36.123456+07';

test('cursor round-trips with microseconds intact', () => {
  assert.deepEqual(decodeCursor(encodeCursor({ at, id })), { at, id });
});

test('missing, malformed or tampered cursors restart from the newest page', () => {
  assert.equal(decodeCursor(undefined), null);
  assert.equal(decodeCursor('not base64 at all'), null);
  assert.equal(decodeCursor(encodeCursor({ at, id: "1' or '1'='1" })), null);
  assert.equal(decodeCursor(encodeCursor({ at: 'yesterday', id })), null);
});

test('toPage trims the lookahead row and only then offers a next cursor', () => {
  const rows = [1, 2, 3].map((n) => ({ id: `${id.slice(0, -1)}${n}`, cursorAt: `${at}`, n }));
  const full = toPage(rows, 2);
  assert.equal(full.items.length, 2);
  assert.deepEqual(decodeCursor(full.nextCursor), { at, id: rows[1]!.id });
  assert.equal(toPage(rows.slice(0, 2), 2).nextCursor, null);
});

test('Next then Prev lands back on the same page', async () => {
  const { toPageBoth, readPageRequest } = await import('./pagination.ts');
  // 12 rows, newest first: r12 .. r1
  const all = Array.from({ length: 12 }, (_, i) => ({ id: `${id.slice(0, -2)}${String(12 - i).padStart(2, '0')}`, cursorAt: `2026-11-18 08:${String(12 - i).padStart(2, '0')}:00+07`, n: 12 - i }));
  const olderThanRow = (c: { at: string }) => all.filter((r) => r.cursorAt < c.at);
  const newerThanRow = (c: { at: string }) => all.filter((r) => r.cursorAt > c.at).reverse(); // ascending

  const p1 = toPageBoth(all.slice(0, 6), readPageRequest({}), 5);
  assert.deepEqual(p1.items.map((r) => r.n), [12, 11, 10, 9, 8]);
  assert.equal(p1.prevCursor, null);

  const r2 = readPageRequest({ before: p1.nextCursor! });
  const p2 = toPageBoth(olderThanRow(r2.cursor!).slice(0, 6), r2, 5);
  assert.deepEqual(p2.items.map((r) => r.n), [7, 6, 5, 4, 3]);
  assert.ok(p2.prevCursor && p2.nextCursor);

  const back = readPageRequest({ after: p2.prevCursor! });
  const p1b = toPageBoth(newerThanRow(back.cursor!).slice(0, 6), back, 5);
  assert.deepEqual(p1b.items.map((r) => r.n), [12, 11, 10, 9, 8]);
  assert.equal(p1b.prevCursor, null, 'newest page has no Prev');
  assert.ok(p1b.nextCursor);
});
