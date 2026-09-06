# Morphic

One API to access multiple AI models, with unified credit billing.

```text
Base URL: https://api.morphic.xxx/v1
API Key:  mp-xxxxxxxx
Model:    deepseek-v4
```

## What is Morphic?

Morphic is a unified AI gateway. Instead of integrating each AI provider
separately, developers use a single OpenAI-compatible API and switch between
models (DeepSeek, Qwen, Kimi, and more) from one account and one credit system.

## Quick Start

```bash
cp .env.example .env       # fill secrets; PROVIDER_ENC_KEY: openssl rand -hex 32
docker compose up -d postgres redis
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev                   # web :3000, api :8787
```

First admin: sign in once with Google, then run
`pnpm --filter @morphic/db make-admin you@example.com`.

## Example Request

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer mp-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-v4", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Project Structure

```text
apps/web       Dashboard + admin (Next.js, Google OAuth via Better Auth)
apps/api       API gateway (Hono) — /v1/*, streaming, webhooks
packages/db    Postgres schema (Drizzle) + billing domain service
packages/shared Shared contracts, credit math, API key utilities
```

## Documentation

- [Contributing](./CONTRIBUTING.md) — how to contribute
- [Code of Conduct](./CODE_OF_CONDUCT.md) — community standards
- [Security Policy](./SECURITY.md) — reporting vulnerabilities
- [License](./LICENSE) — Apache 2.0

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
