import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPageTotal, keysetLinks, keysetNav, keysetPageNumber, latestOnly, loadPage, pageWindow, readPage, toNumberedPage } from './page-numbers.ts';

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

test('readPage turns junk into page 1 and keeps real page numbers', () => {
  for (const junk of [undefined, null, '', 'abc', '0', '-3', '2.5', '1e3x']) assert.equal(readPage(junk), 1, String(junk));
  assert.equal(readPage('4'), 4);
  assert.equal(readPage(['2', '3']), 2);
});

test('toNumberedPage shows 5 rows and uses the 6th only to say a next page exists', () => {
  const p = toNumberedPage(rows(6), 2, { total: 23, capped: false });
  assert.deepEqual(p.items, [0, 1, 2, 3, 4]);
  assert.equal(p.lastPage, 5);
  assert.equal(p.hasNext, true);
  assert.equal(toNumberedPage(rows(3), 5, { total: 23, capped: false }).hasNext, false);
});

test('a capped count stops at page 200 but Next keeps working past it', () => {
  const p = toNumberedPage(rows(6), 200, { total: 1000, capped: true });
  assert.equal(p.lastPage, 200);
  assert.equal(p.capped, true);
  assert.equal(p.hasNext, true);
});

test('loadPage clamps a page past the end back to the last real page', async () => {
  const calls: [number, number][] = [];
  const p = await loadPage(
    9,
    async (offset, limit) => {
      calls.push([offset, limit]);
      return offset === 10 ? rows(2) : [];
    },
    async () => ({ total: 12, capped: false }),
  );
  assert.equal(p.page, 3);
  assert.equal(p.items.length, 2);
  assert.deepEqual(calls, [[40, 6], [10, 6]]);
});

test('loadPage does not clamp when the count is capped', async () => {
  const p = await loadPage(250, async () => [], async () => ({ total: 1000, capped: true }));
  assert.equal(p.page, 250);
  assert.equal(p.items.length, 0);
});

test('loadPage runs the row query and the count together', async () => {
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const done = loadPage(
    1,
    async () => {
      started.push('rows');
      await gate;
      return rows(1);
    },
    async () => {
      started.push('count');
      await gate;
      return { total: 1, capped: false };
    },
  );
  await Promise.resolve();
  assert.deepEqual(started.sort(), ['count', 'rows']);
  release();
  await done;
});

test('pageWindow keeps first, last and the neighbours of the current page', () => {
  const w = (page: number, lastPage: number, capped = false, hasNext = page < lastPage) => pageWindow({ page, lastPage, capped, hasNext });
  assert.deepEqual(w(1, 1), []);
  assert.deepEqual(w(5, 24), [1, 'gap', 4, 5, 6, 'gap', 24]);
  assert.deepEqual(w(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(w(1, 200, true), [1, 2, 'gap', 200]);
  assert.deepEqual(w(3, 5), [1, 2, 3, 4, 5]);
});

test('pageWindow still shows a pager on page 1 of 1 when the lookahead says more exist', () => {
  assert.deepEqual(pageWindow({ page: 1, lastPage: 1, capped: false, hasNext: true }), [1]);
});

test('formatPageTotal says how many rows the list holds, with + once the count is capped', () => {
  assert.equal(formatPageTotal({ total: 23, capped: false }), '23');
  assert.equal(formatPageTotal({ total: 1000, capped: true }), '1000+');
});

test('latestOnly drops a slow answer once a newer request has started', async () => {
  const latest = latestOnly();
  let releaseOld!: (v: string) => void;
  const old = latest.run(new Promise<string>((r) => (releaseOld = r)));
  const fresh = latest.run(Promise.resolve('new'));
  releaseOld('old');
  assert.deepEqual(await fresh, { current: true, value: 'new' });
  assert.deepEqual(await old, { current: false });
});

test('latestOnly.reset makes an in-flight answer stale', async () => {
  const latest = latestOnly();
  const pending = latest.run(Promise.resolve(1));
  latest.reset();
  assert.deepEqual(await pending, { current: false });
});

test('latestOnly swallows a stale failure but still throws the latest one', async () => {
  const latest = latestOnly();
  let failOld!: (e: Error) => void;
  const old = latest.run(new Promise<string>((_, reject) => (failOld = reject)));
  const fresh = latest.run(Promise.reject(new Error('fresh failed')));
  failOld(new Error('old failed'));
  assert.deepEqual(await old, { current: false });
  await assert.rejects(fresh, /fresh failed/);
});

test('keysetNav walks older, back newer, and jumps to the newest page', () => {
  const start = { cursor: null, back: [] };
  const p2 = keysetNav(start, 'older', 'c2');
  const p3 = keysetNav(p2, 'older', 'c3');
  assert.deepEqual(p3, { cursor: 'c3', back: [null, 'c2'] });
  assert.equal(keysetPageNumber(p3), 3);
  assert.deepEqual(keysetNav(p3, 'newer'), { cursor: 'c2', back: [null] });
  assert.deepEqual(keysetNav(keysetNav(p3, 'newer'), 'newer'), start);
  assert.deepEqual(keysetNav(p3, 'newest'), start);
  assert.equal(keysetPageNumber(start), 1);
});

test('keysetNav stays put when there is nowhere to go', () => {
  const start = { cursor: null, back: [] };
  assert.deepEqual(keysetNav(start, 'newer'), start);
  assert.deepEqual(keysetNav(start, 'older', null), start);
});

test('keysetLinks keeps filters, counts the page in n, and Newest drops the cursor', () => {
  const l = keysetLinks({ path: '/admin/audit', params: { q: 'abc', action: undefined }, n: '3', prevCursor: 'P', nextCursor: 'N' });
  assert.equal(l.page, 3);
  assert.equal(l.hasNewer, true);
  assert.equal(l.hasOlder, true);
  assert.equal(l.href('older'), '/admin/audit?q=abc&before=N&n=4');
  assert.equal(l.href('newer'), '/admin/audit?q=abc&after=P&n=2');
  assert.equal(l.href('newest'), '/admin/audit?q=abc');
});

test('keysetLinks calls a page with no Newer page "page 1" whatever n says', () => {
  assert.equal(keysetLinks({ path: '/x', n: '7', prevCursor: null, nextCursor: 'N' }).page, 1);
  assert.equal(keysetLinks({ path: '/x', n: '7', prevCursor: null, nextCursor: 'N' }).page, 1);
  assert.equal(keysetLinks({ path: '/x', n: 'junk', prevCursor: 'P', nextCursor: null }).page, 2);
  assert.equal(keysetLinks({ path: '/x', prevCursor: null, nextCursor: null }).href('newest'), '/x');
});
