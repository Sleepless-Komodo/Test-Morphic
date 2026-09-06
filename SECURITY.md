# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

Morphic is pre-1.0. Security fixes land on `main` and are released promptly.

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, report them privately via:

- GitHub private vulnerability reporting (preferred), or
- Email: security@morphic.dev

Include:

- Description of the issue
- Steps to reproduce (proof of concept if possible)
- Affected version/commit
- Potential impact

We aim to acknowledge reports within 48 hours and provide an initial assessment
within 7 days.

## Security Model Notes

Morphic handles API keys, provider credentials, payments, and credits. The
following invariants are enforced in code and must not be weakened:

- User API keys (`mp-*`) are stored only as SHA-256 hashes; the raw key is
  shown exactly once at creation.
- Provider credentials are encrypted at rest (AES-256-GCM) or referenced via
  environment (`credential_reference`); they are never rendered in any UI or
  API response.
- Billing mutations are transactional: `credit_ledger` is the source of truth,
  `balances` is a cache updated atomically in the same transaction.
- Payment webhooks verify signatures and deduplicate events via the
  `payment_events` table (replays never double-grant).
- Gateway requests are rate-limited and concurrency-capped per API key.

If you find a way to violate any of these invariants, that is a security bug —
please report it as described above.

## Scope

In-scope for reports:

- Authentication/authorization bypass (dashboard sessions or `mp-*` API keys)
- Billing manipulation (negative balances, double grants, reservation abuse)
- Webhook forgery or replay
- Credential leakage (provider keys, user keys)
- Injection or SSRF in the gateway/provider adapter

Out of scope:

- Issues in third-party providers (report upstream)
- Social engineering
- Missing rate limits on endpoints not yet hardened (tracked publicly)
