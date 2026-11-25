'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_NEXT_PATH, nextPathFromLocation } from './safe-next';

// The address does not change while a sign-in page is open, so there is nothing to subscribe to.
const subscribeToNothing = () => () => {};
const nextPathOnServer = () => DEFAULT_NEXT_PATH;

/**
 * The safe `?next=` destination of the current page. Server render and hydration use the default;
 * the real value is read from the address right after, so the markup always matches.
 */
export function useNextPath(): string {
  return useSyncExternalStore(subscribeToNothing, nextPathFromLocation, nextPathOnServer);
}
