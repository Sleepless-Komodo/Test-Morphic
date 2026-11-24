import { headers } from 'next/headers';
import { loginUrl } from './safe-next';

/**
 * `/login?next=<page being served>` for server components and actions that found no session.
 * The middleware stamps `x-morphic-path` on every request, overwriting any client-sent value.
 */
export async function loginUrlForCurrentPage(): Promise<string> {
  return loginUrl((await headers()).get('x-morphic-path'));
}
