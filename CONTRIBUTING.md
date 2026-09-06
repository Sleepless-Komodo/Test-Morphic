# Contributing to Morphic

Thanks for your interest in contributing to Morphic!

## Code of Conduct

By participating, you agree to uphold the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](./LICENSE).

## How to Contribute

### Report Bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node version, commit hash)

### Suggest Features

Open an issue describing the use case, not just the solution. Discuss before
building large features.

### Submit Changes

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Install dependencies and set up your environment:
   ```bash
   cp .env.example .env
   pnpm install
   docker compose up -d postgres redis
   pnpm db:migrate && pnpm db:seed
   ```
3. Make your change. Follow the existing code style (TypeScript strict,
   no comments unless necessary, surgical diffs).
4. Verify before opening a PR:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm build
   pnpm db:e2e      # gateway + billing end-to-end (requires api running)
   ```
5. Open a pull request describing what changed and why.

## Development Guidelines

- **Monorepo layout**: UI in `apps/web`, gateway in `apps/api`, schema and
  billing domain in `packages/db`, shared pure logic in `packages/shared`.
- **Billing rules** (do not break these):
  - `credit_ledger` is the source of truth; `balances` is a cache updated in
    the same transaction. Never write to `balances` outside a ledger-writing
    transaction.
  - All gateway billing goes through reserve → settle. Never deduct after the
    response without a reservation.
  - Settlement never charges more than the reservation estimate.
- **Security rules**:
  - Never log or return raw API keys (`mp-*`) or provider credentials.
  - Provider credentials must be stored encrypted or via `credential_reference`.
  - Webhooks must verify signatures and deduplicate via `payment_events`.
- **Database changes**: edit `packages/db/src/schema.ts`, then run
  `pnpm db:generate` and commit the generated migration.

## Security Issues

Do not open public issues for vulnerabilities. See [SECURITY.md](./SECURITY.md).
