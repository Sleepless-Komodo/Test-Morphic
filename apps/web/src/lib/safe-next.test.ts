import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NEXT_PATH, loginUrl, safeNextPath, withNext } from './safe-next.ts';

test('safeNextPath: keeps same-site paths and their query', () => {
  assert.equal(safeNextPath('/dashboard/billing'), '/dashboard/billing');
  assert.equal(safeNextPath('/dashboard/billing?pkg=abc&x=1'), '/dashboard/billing?pkg=abc&x=1');
  assert.equal(safeNextPath('/dashboard/../dashboard/keys'), '/dashboard/keys');
});

test('safeNextPath: falls back for empty, absolute, protocol-relative and backslash targets', () => {
  for (const raw of [undefined, null, '', 'dashboard', 'https://evil.test/x', '//evil.test', '/\\evil.test', '/a\\b', 'javascript:alert(1)']) {
    assert.equal(safeNextPath(raw), DEFAULT_NEXT_PATH, String(raw));
  }
});

test('safeNextPath: rejects control characters and oversized values', () => {
  assert.equal(safeNextPath('/dashboard\n/x'), DEFAULT_NEXT_PATH);
  assert.equal(safeNextPath('/dashboard\u0000'), DEFAULT_NEXT_PATH);
  assert.equal(safeNextPath(`/${'a'.repeat(600)}`), DEFAULT_NEXT_PATH);
});

test('safeNextPath: never loops back into auth pages or the API', () => {
  for (const raw of ['/login', '/login/email?next=/x', '/forgot-password', '/reset-password/abc', '/api/backend/v1/keys']) {
    assert.equal(safeNextPath(raw), DEFAULT_NEXT_PATH, raw);
  }
  assert.equal(safeNextPath('/loginfoo'), '/loginfoo');
});

test('safeNextPath: drops the internal _rsc parameter and keeps the rest', () => {
  assert.equal(safeNextPath('/dashboard/keys?_rsc=abc12'), '/dashboard/keys');
  assert.equal(safeNextPath('/dashboard/billing?pkg=a&_rsc=x'), '/dashboard/billing?pkg=a');
});

test('safeNextPath: honours a custom fallback', () => {
  assert.equal(safeNextPath('https://evil.test', '/'), '/');
});

test('loginUrl: carries the current page as an encoded next, or none when it is unsafe', () => {
  assert.equal(loginUrl('/dashboard/billing?pkg=a b'), '/login?next=%2Fdashboard%2Fbilling%3Fpkg%3Da%2520b');
  assert.equal(loginUrl('/login'), '/login');
  assert.equal(loginUrl('//evil.test'), '/login');
  assert.equal(loginUrl(null), '/login');
  assert.equal(loginUrl('/dashboard'), '/login');
});

test('withNext: appends next only when it differs from the default destination', () => {
  assert.equal(withNext('/login/email', '/dashboard/keys'), '/login/email?next=%2Fdashboard%2Fkeys');
  assert.equal(withNext('/login/email', '/dashboard'), '/login/email');
  assert.equal(withNext('/login/email', 'https://evil.test'), '/login/email');
});
