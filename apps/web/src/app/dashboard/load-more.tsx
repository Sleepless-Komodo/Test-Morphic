'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

// PAGE_SIZE in lib/pagination.ts; that module pulls in drizzle, so it stays out of client bundles.
const STEP = 5;

export interface LoadMorePage<T> {
  data: T[];
  nextCursor: string | null;
}

/**
 * Rows from a first server-rendered page plus every older page appended by "Load more".
 * A new `initial` (router.refresh) starts over from it; a failed load keeps the rows already shown.
 */
export function useLoadMore<T>(initial: LoadMorePage<T>, fetchPage: (p: { before: string }) => Promise<LoadMorePage<T>>) {
  const [base, setBase] = useState(initial);
  const [rows, setRows] = useState(initial.data);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (base !== initial) {
    setBase(initial);
    setRows(initial.data);
    setNextCursor(initial.nextCursor);
    setFailed(false);
  }

  const loadMore = async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await fetchPage({ before: nextCursor });
      setRows((prev) => [...prev, ...page.data]);
      setNextCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return { rows, nextCursor, loading, failed, loadMore };
}

export function LoadMoreButton({
  nextCursor,
  loading,
  failed,
  onClick,
  en,
}: {
  nextCursor: string | null;
  loading: boolean;
  failed: boolean;
  onClick: () => void;
  en: boolean;
}) {
  if (!nextCursor) return null;
  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-800 hover:border-neutral-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        <span suppressHydrationWarning>{en ? `Load ${STEP} more` : `Muat ${STEP} lagi`}</span>
      </button>
      {failed && (
        <p role="alert" suppressHydrationWarning className="text-xs text-red-700">
          {en ? "Couldn't load more. Try again." : 'Gagal memuat data. Coba lagi.'}
        </p>
      )}
    </div>
  );
}
