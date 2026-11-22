import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft } from 'lucide-react';
import type { KeysetMove } from '@/lib/page-numbers';

const cell =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2';
const off = 'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

type KeysetPagerProps = { page: number; hasNewer: boolean; hasOlder: boolean; en: boolean } & (
  | { href: (to: KeysetMove) => string; onMove?: never; disabled?: never }
  | { onMove: (to: KeysetMove) => void; disabled?: boolean; href?: never }
);

/**
 * Newer / Older for the lists that keep growing (logs, payments, ledger, audit): one cheap query per
 * page and rows never repeat while new ones arrive. There is no total, so the page number is how far
 * back the reader went, and "Newest" jumps straight back to the top.
 * Server pages pass `href` (cursors ride in the URL); client views pass `onMove`.
 */
export function KeysetPager(props: KeysetPagerProps) {
  const { page, hasNewer, hasOlder, en } = props;
  if (!hasNewer && !hasOlder) return null;

  // Below sm the Newest/Newer buttons show only their icon, so the label moves to aria-label.
  const go = (to: KeysetMove, label: string, children: ReactNode, hideTextOnPhone = false) => {
    if (props.href) {
      return (
        <Link href={props.href(to)} className={cell} aria-label={hideTextOnPhone ? label : undefined}>
          {children}
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={() => props.onMove(to)}
        disabled={props.disabled}
        className={`${cell} ${off}`}
        aria-label={hideTextOnPhone ? label : undefined}
      >
        {children}
      </button>
    );
  };

  const newest = en ? 'Newest' : 'Terbaru';
  const newer = en ? 'Newer' : 'Lebih baru';
  const older = en ? 'Older' : 'Lebih lama';

  return (
    <nav aria-label={en ? 'Pagination' : 'Navigasi halaman'} className="flex items-center justify-between gap-2 pt-4">
      <div className="flex items-center gap-1.5">
        {hasNewer &&
          go(
            'newest',
            newest,
            <>
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{newest}</span>
            </>,
            true,
          )}
        {hasNewer &&
          go(
            'newer',
            newer,
            <>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{newer}</span>
            </>,
            true,
          )}
      </div>

      <span className="text-sm font-semibold tabular-nums text-neutral-700" aria-live="polite">
        {en ? 'Page' : 'Halaman'} {page}
      </span>

      <div className="flex items-center">
        {hasOlder ? (
          go(
            'older',
            older,
            <>
              <span>{older}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </>,
          )
        ) : (
          <span className="h-10 w-10" aria-hidden="true" />
        )}
      </div>
    </nav>
  );
}
