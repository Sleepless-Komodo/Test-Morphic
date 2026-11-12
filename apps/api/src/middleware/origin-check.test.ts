import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, isMutationAllowed } from './origin-check.js';

const allowed = new Set(['https://app.example']);

test('1. GET with cookie and no Origin is allowed', () => {
  assert.equal(isMutationAllowed({ method: 'GET', cookie: 'session_token=abc' }, allowed), true);
});

test('2. POST with Authorization Bearer and cookie, no Origin is allowed', () => {
  assert.equal(
    isMutationAllowed({ method: 'POST', authorization: 'Bearer tok', cookie: 'session_token=abc' }, allowed),
    true,
  );
});

test('3. POST with cookie only and allowed Origin is allowed', () => {
  assert.equal(
    isMutationAllowed({ method: 'POST', cookie: 'session_token=abc', origin: 'https://app.example' }, allowed),
    true,
  );
});

test('4. POST with cookie only and evil Origin is rejected', () => {
  assert.equal(
    isMutationAllowed({ method: 'POST', cookie: 'session_token=abc', origin: 'https://evil.example' }, allowed),
    false,
  );
});

test('5. POST with cookie only and neither Origin nor Referer is rejected', () => {
  assert.equal(isMutationAllowed({ method: 'POST', cookie: 'session_token=abc' }, allowed), false);
});

test('6. POST with cookie only and Origin: "null" is rejected', () => {
  assert.equal(isMutationAllowed({ method: 'POST', cookie: 'session_token=abc', origin: 'null' }, allowed), false);
});

test('7. POST with cookie only, no Origin, and Referer on allowed origin with path is allowed', () => {
  assert.equal(
    isMutationAllowed(
      { method: 'POST', cookie: 'session_token=abc', referer: 'https://app.example/dashboard/keys' },
      allowed,
    ),
    true,
  );
});

test('8. POST with no cookie and no Authorization is allowed (falls through to 401)', () => {
  assert.equal(isMutationAllowed({ method: 'POST' }, allowed), true);
});

test('9. allowedOrigins normalizes NEXT_PUBLIC_APP_URL with path to its origin', () => {
  const origins = allowedOrigins({ NEXT_PUBLIC_APP_URL: 'https://app.example/x' });
  assert.deepEqual([...origins], ['https://app.example']);
});

test('10. allowedOrigins returns empty set in production when NEXT_PUBLIC_APP_URL is unset', () => {
  const origins = allowedOrigins({ NODE_ENV: 'production' });
  assert.equal(origins.size, 0);
});
