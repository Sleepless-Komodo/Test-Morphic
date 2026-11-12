import { Hono } from 'hono';
import { jsonBodyLimit, MANAGEMENT_MAX_BODY_BYTES } from '../middleware/body-limit';
import { cookieOriginGuard } from '../middleware/origin-check';
import { sessionAuth, denyKeyDerivedSession } from '../middleware/session-auth';
import { sessionRateLimit } from '../middleware/session-ratelimit';
import { handleRedeem, RedeemError, isUniqueViolation } from '../handlers/redeem';

const redeem = new Hono();

redeem.use('*', jsonBodyLimit(MANAGEMENT_MAX_BODY_BYTES, '1MB'));
redeem.use('*', cookieOriginGuard);
redeem.use('*', sessionAuth);
redeem.use('*', denyKeyDerivedSession);
// Cap redemption attempts to blunt code brute-forcing (audit H3).
redeem.use('*', sessionRateLimit('redeem', 10));

// ── POST /v1/redeem ───────────────────────────────────
redeem.post('/', handleRedeem);

export { redeem, RedeemError, isUniqueViolation };
