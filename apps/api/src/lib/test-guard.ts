/**
 * Test Database Safety Guard
 *
 * Ensures tests never execute against production or un-allowlisted databases.
 * Runs before any database connection or test suite execution.
 */

export const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];

export function getDatabaseHost(connectionString: string | undefined): string | null {
  if (!connectionString) return null;
  try {
    const u = new URL(connectionString);
    return u.hostname.replace(/^\[|\]$/g, '');
  } catch {
    return null;
  }
}

export function isHostAllowed(host: string | null, extraHosts?: string): boolean {
  if (!host) return false;
  const allowed = new Set(DEFAULT_ALLOWED_HOSTS);
  if (extraHosts) {
    for (const h of extraHosts.split(',')) {
      const trimmed = h.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }
  return allowed.has(host);
}

export function assertTestDatabaseAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('[test-guard] Refusing to run tests: NODE_ENV is set to "production"');
  }

  if (env.ALLOW_TEST_DB_WRITE !== '1') {
    throw new Error(
      '[test-guard] Refusing to run tests: ALLOW_TEST_DB_WRITE must be set to "1". Check your .env.test',
    );
  }

  const host = getDatabaseHost(env.DATABASE_URL);
  if (!host || !isHostAllowed(host, env.TEST_DB_HOST_ALLOWLIST)) {
    throw new Error(
      `[test-guard] Refusing to run tests: DATABASE_URL host (${host ?? 'missing/invalid'}) is not in allowlist: [${DEFAULT_ALLOWED_HOSTS.join(', ')}]${
        env.TEST_DB_HOST_ALLOWLIST ? ` plus TEST_DB_HOST_ALLOWLIST: [${env.TEST_DB_HOST_ALLOWLIST}]` : ''
      }`,
    );
  }
}

// Auto-run when imported by Node runner if not explicitly disabled for unit testing:
if (process.env.SKIP_TEST_GUARD !== '1') {
  try {
    assertTestDatabaseAllowed(process.env);
  } catch (err: any) {
    console.error(`\n❌ FATAL TEST GUARD FAILURE:\n${err.message}\n`);
    process.exit(1);
  }
}
