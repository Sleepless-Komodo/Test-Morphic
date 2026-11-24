import { loginUrl } from './safe-next';

/**
 * fetch() for the same-origin `/api/backend` proxy, for client components.
 *
 * A 401 means the session is gone. The helper sends the user to `/login?next=<this page>` and
 * throws `SessionExpiredError`, so callers do not show a misleading "try again" message while the
 * browser navigates. Callers that catch should `return` early when `isSessionExpiredError(err)`.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

export function isSessionExpiredError(err: unknown): err is SessionExpiredError {
  return err instanceof SessionExpiredError;
}

function goToLogin(): void {
  window.location.assign(loginUrl(window.location.pathname + window.location.search));
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`/api/backend${path}`, init);
  if (response.status === 401) {
    goToLogin();
    throw new SessionExpiredError();
  }
  return response;
}
