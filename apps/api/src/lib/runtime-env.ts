/** True only for local development and automated tests. Everything else (unset, staging, production) is "not dev". */
export function isDevOrTestEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}
