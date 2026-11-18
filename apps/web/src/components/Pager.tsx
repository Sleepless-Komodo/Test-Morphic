import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const btn =
  'inline-flex h-9 items-center gap-1 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-950 hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2';

/**
 * Previous / Next links for URL-paginated lists (see readPageRequest, keyset and toPageBoth in
 * lib/pagination.ts). Cursors ride in the URL, so pages are linkable and the browser's back button
 * works. `params` keeps the page's other filters; pass them without before/after.
 */
export function Pager({
  path,
  params = {},
  prevCursor,
  nextCursor,
  en,
}: {
  path: string;
  params?: Record<string, string | undefined>;
  prevCursor: string | null;
  nextCursor: string | null;
  en: boolean;
}) {
  if (!prevCursor && !nextCursor) return null;
  const href = (key: 'before' | 'after', cursor: string) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
    q.set(key, cursor);
    return `${path}?${q.toString()}`;
  };
  return (
    <nav aria-label={en ? 'Pagination' : 'Navigasi halaman'} className="flex items-center justify-between gap-3 pt-4">
      {prevCursor ? (
        <Link href={href('after', prevCursor)} className={btn}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {en ? 'Previous' : 'Sebelumnya'}
        </Link>
      ) : (
        <span />
      )}
      {nextCursor && (
        <Link href={href('before', nextCursor)} className={btn}>
          {en ? 'Next' : 'Berikutnya'}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
