import { Hono } from 'hono';
import { jsonBodyLimit, MANAGEMENT_MAX_BODY_BYTES } from '../middleware/body-limit';
import { cookieOriginGuard } from '../middleware/origin-check';
import { denyKeyDerivedSession, sessionAuth } from '../middleware/session-auth';
import { sessionRateLimit } from '../middleware/session-ratelimit';
import {
  handleGetBalance,
  handleGetUsage,
  handleGetTransactions,
  handleGetEntitlements,
  handleGetPayments,
  handleExportData,
  handleListDsarRequests,
} from '../handlers/account';

const account = new Hono();

account.use('*', jsonBodyLimit(MANAGEMENT_MAX_BODY_BYTES, '1MB'));
account.use('*', cookieOriginGuard);
account.use('*', sessionAuth);
account.use('*', sessionRateLimit('account', 120));

account.get('/balance', handleGetBalance);

account.get('/usage', handleGetUsage);

account.get('/transactions', handleGetTransactions);

// ── GET /v1/account/entitlements ──────────────────────
// Active, unexpired model entitlements for the authenticated user.
account.get('/entitlements', handleGetEntitlements);

// ── GET /v1/account/payments ──────────────────────────
// Payment history for the authenticated user (never cross-user).
account.get('/payments', handleGetPayments);

// ── GET & POST /v1/account/export ─────────────────────
// Personal-data export (UU PDP access right / FIX-P1-06):
// - Blocked for API-key-derived sessions (`denyKeyDerivedSession`) so a leaked mp-* key cannot exfiltrate PII.
// - Tracked in `dsar_requests` + audited in `admin_audit_log`, with bounded per-section row limits.
account.get('/export', denyKeyDerivedSession, sessionRateLimit('account-export', 5), handleExportData);
account.post('/export', denyKeyDerivedSession, sessionRateLimit('account-export', 5), handleExportData);
account.get('/export/requests', denyKeyDerivedSession, handleListDsarRequests);

export { account };
