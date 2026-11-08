#!/usr/bin/env bash
# Runs API tests against a LOCAL throwaway database only. Never reads a remote URL in .env.test.
# Usage (from repo root): bash apps/api/scripts/test-local.sh src/lib/ip.test.ts
#                         bash apps/api/scripts/test-local.sh "src/**/*.test.ts"
set -euo pipefail

export DATABASE_URL="${LOCAL_TEST_DATABASE_URL:-postgresql://morphic:morphic@127.0.0.1:5432/morphic_test}"
export NODE_ENV=test
export ALLOW_TEST_DB_WRITE=1
export TEST_DB_HOST_ALLOWLIST=""   # shell values win over --env-file, so .env.test cannot re-allow remote hosts

host=$(node -e "console.log(new URL(process.env.DATABASE_URL).hostname)")
db=$(node -e "console.log(new URL(process.env.DATABASE_URL).pathname.slice(1))")
case "$host" in
  127.0.0.1|localhost) ;;
  *) echo "refusing: DATABASE_URL host '$host' is not local" >&2; exit 1 ;;
esac
case "$db" in
  *_test) ;;
  *) echo "refusing: database '$db' must end with _test" >&2; exit 1 ;;
esac
pg_isready -h "$host" -p 5432 -q || { echo "refusing: Postgres is not accepting connections on $host:5432" >&2; exit 1; }

cd "$(dirname "$0")/.."
echo "[test-local] db=$host/$db"
exec pnpm exec tsx --import ./src/lib/test-guard.ts --test --env-file=../../.env.test "$@"
