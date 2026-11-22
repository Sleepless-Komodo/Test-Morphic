import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { pageWindow, type NumberedPage } from '@/lib/page-numbers';

const cell =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-3 text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2';
const idle = `${cell} border border-neutral-300 bg-white text-neutral-950 hover:border-neutral-950`;
const current = `${cell} border border-neutral-950 bg-neutral-950 text-white`;
const off = 'disabled:cursor-not-allowed disabled:opacity-50';

type PagerProps = Pick<NumberedPage<unknown>, 'page' | 'lastPage' | 'capped' | 'hasNext'> & { en: boolean } & (
    | { href: (page: number) => string; onPage?: never; disabled?: never }
    | { onPage: (page: number) => void; disabled?: boolean; href?: never }
  );

/**
 * Numbered pages for the 5-row history lists (see lib/page-numbers.ts). Server pages pass `href`,
 * so each page is a plain link that keeps working with the back button. Client views pass `onPage`.
 * No hooks here, so it renders on either side.
 */
export function Pager(props: PagerProps) {
  const { page, lastPage, capped, hasNext, en } = props;
  const items = pageWindow({ page, lastPage, capped, hasNext });
  if (items.length === 0) return null;
  const last = Math.max(lastPage, page);
  const label = (n: number) => (capped && n === last ? `${n}+` : String(n));

  const go = (n: number, className: string, children: ReactNode, aria?: { label?: string; current?: boolean }) => {
    const common = { className, 'aria-label': aria?.label, 'aria-current': aria?.current ? ('page' as const) : undefined };
    if (props.href) {
      return (
        <Link key={`${n}-${aria?.label ?? ''}`} href={props.href(n)} {...common}>
          {children}
        </Link>
      );
    }
    // The page on screen is not an action, so it reads at full strength instead of as a disabled button.
    if (aria?.current) {
      return (
        <span key={`${n}-${aria.label ?? ''}`} {...common}>
          {children}
        </span>
      );
    }
    return (
      <button
        key={`${n}-${aria?.label ?? ''}`}
        type="button"
        onClick={() => props.onPage(n)}
        disabled={props.disabled}
        className={`${className} ${off} cursor-pointer`}
        aria-label={common['aria-label']}
        aria-current={common['aria-current']}
      >
        {children}
      </button>
    );
  };

  const prevLabel = en ? 'Previous page' : 'Halaman sebelumnya';
  const nextLabel = en ? 'Next page' : 'Halaman berikutnya';

  return (
    <nav aria-label={en ? 'Pagination' : 'Navigasi halaman'} className="flex items-center justify-between gap-2 pt-4 sm:justify-center">
      {page > 1 ? (
        go(page - 1, idle, <ChevronLeft className="h-4 w-4" aria-hidden="true" />, { label: prevLabel })
      ) : (
        <span className="h-10 w-10" aria-hidden="true" />
      )}

      <span className="text-sm font-semibold tabular-nums text-neutral-700 sm:hidden">
        {page} / {label(last)}
      </span>

      <ol className="hidden items-center gap-1.5 sm:flex">
        {items.map((n, i) =>
          n === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-sm text-neutral-500">
              …
            </li>
          ) : (
            <li key={n}>
              {go(n, n === page ? current : idle, label(n), {
                label: `${en ? 'Page' : 'Halaman'} ${label(n)}`,
                current: n === page,
              })}
            </li>
          ),
        )}
      </ol>

      {hasNext ? (
        go(page + 1, idle, <ChevronRight className="h-4 w-4" aria-hidden="true" />, { label: nextLabel })
      ) : (
        <span className="h-10 w-10" aria-hidden="true" />
      )}
    </nav>
  );
}
