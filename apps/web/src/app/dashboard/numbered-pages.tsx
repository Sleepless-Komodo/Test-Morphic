'use client';

import { useState } from 'react';
import { Pager } from '@/components/Pager';
import { KeysetPager } from '@/components/KeysetPager';
import { keysetNav, keysetPageNumber, latestOnly, type KeysetMove, type KeysetNav, type NumberedPage } from '@/lib/page-numbers';

/**
 * A numbered list whose first page was rendered on the server and whose other pages come from a
 * server action. A new `initial` (router.refresh) starts over from it; a failed load keeps the page
 * already shown. Only the newest request lands, so a slow page can never replace a later filter.
 */
export function useNumberedPages<T>(initial: NumberedPage<T>, fetchPage: (p: { page: number }) => Promise<NumberedPage<T>>) {
  const [base, setBase] = useState(initial);
  const [current, setCurrent] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [latest] = useState(latestOnly);

  if (base !== initial) {
    setBase(initial);
    setCurrent(initial);
    setFailed(false);
    setLoading(false);
    latest.reset();
  }

  /** Swap in the page `run` returns. Filters changing on the client call this with their new values. */
  const load = async (run: () => Promise<NumberedPage<T>>) => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await latest.run(run());
      if (!res.current) return;
      setCurrent(res.value);
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  };
  const goTo = (page: number) => load(() => fetchPage({ page }));

  return { ...current, loading, failed, goTo, load };
}

/** Pager for a useNumberedPages list, plus the message when a page fails to load. */
export function NumberedPager<T>({ list, en }: { list: ReturnType<typeof useNumberedPages<T>>; en: boolean }) {
  return (
    <>
      <Pager
        page={list.page}
        lastPage={list.lastPage}
        capped={list.capped}
        hasNext={list.hasNext}
        en={en}
        onPage={list.goTo}
        disabled={list.loading}
      />
      {list.failed && (
        <p role="alert" suppressHydrationWarning className="pt-2 text-center text-xs text-red-700">
          {en ? "Couldn't load that page. Try again." : 'Gagal memuat halaman. Coba lagi.'}
        </p>
      )}
    </>
  );
}

export interface KeysetPage<T> {
  data: T[];
  nextCursor: string | null;
}

const NEWEST: KeysetNav = { cursor: null, back: [] };

/**
 * A growing list read Newer/Older through a keyset server action: one cheap query per page. The
 * first page comes from the server; a new `initial` (router.refresh) goes back to it. Only the
 * newest request lands.
 */
export function useKeysetPages<T>(initial: KeysetPage<T>, fetchPage: (p: { before: string | null }) => Promise<KeysetPage<T>>) {
  const [base, setBase] = useState(initial);
  const [current, setCurrent] = useState(initial);
  const [nav, setNav] = useState(NEWEST);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [latest] = useState(latestOnly);

  if (base !== initial) {
    setBase(initial);
    setCurrent(initial);
    setNav(NEWEST);
    setFailed(false);
    setLoading(false);
    latest.reset();
  }

  const move = async (to: KeysetMove) => {
    const target = keysetNav(nav, to, current.nextCursor);
    if (target === nav) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await latest.run(fetchPage({ before: target.cursor }));
      if (!res.current) return;
      setCurrent(res.value);
      setNav(target);
      setLoading(false);
    } catch {
      setFailed(true);
      setLoading(false);
    }
  };

  return {
    items: current.data,
    page: keysetPageNumber(nav),
    hasNewer: nav.back.length > 0,
    hasOlder: !!current.nextCursor,
    loading,
    failed,
    move,
  };
}

/** Newer / Older pager for a useKeysetPages list, plus the message when a page fails to load. */
export function KeysetListPager({ list, en }: { list: ReturnType<typeof useKeysetPages<unknown>>; en: boolean }) {
  return (
    <>
      <KeysetPager
        page={list.page}
        hasNewer={list.hasNewer}
        hasOlder={list.hasOlder}
        en={en}
        onMove={list.move}
        disabled={list.loading}
      />
      {list.failed && (
        <p role="alert" suppressHydrationWarning className="pt-2 text-center text-xs text-red-700">
          {en ? "Couldn't load that page. Try again." : 'Gagal memuat halaman. Coba lagi.'}
        </p>
      )}
    </>
  );
}
