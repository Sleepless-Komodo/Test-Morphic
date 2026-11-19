import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_STEP_UP_BUMP_MS,
  ADMIN_STEP_UP_IDLE_MS,
  evaluateAdminStepUp,
  formatStepUpValue,
  parseGeoCountry,
  parseStepUpValue,
  safeAdminNextPath,
} from './admin-step-up.ts';

const now = Date.UTC(2026, 10, 19);
const HOUR = 60 * 60 * 1000;

function row(lastBumpMs: number, country: string | null, expiresAt = new Date(now + HOUR)) {
  return { value: formatStepUpValue(lastBumpMs, country), expiresAt };
}

function headersOf(entries: Record<string, string>): Pick<Headers, 'get'> {
  return new Headers(entries);
}

test('window constants match the spec', () => {
  assert.equal(ADMIN_STEP_UP_IDLE_MS, 24 * 60 * 60 * 1000);
  assert.equal(ADMIN_STEP_UP_BUMP_MS, 5 * 60 * 1000);
});

test('no row requires OTP', () => {
  assert.deepEqual(evaluateAdminStepUp({ row: null, nowMs: now, country: 'ID' }), {
    required: true,
    reason: 'no_row',
    bump: false,
    storedCountry: null,
  });
});

test('expired row requires OTP', () => {
  const r = evaluateAdminStepUp({ row: row(now - HOUR, 'ID', new Date(now - 1)), nowMs: now, country: 'ID' });
  assert.equal(r.required, true);
  assert.equal(r.reason, 'expired');
});

test('fresh row passes without bump', () => {
  assert.deepEqual(evaluateAdminStepUp({ row: row(now - 60_000, 'ID'), nowMs: now, country: 'ID' }), {
    required: false,
    reason: 'ok',
    bump: false,
    storedCountry: 'ID',
  });
});

test('stale bump is due', () => {
  const r = evaluateAdminStepUp({ row: row(now - ADMIN_STEP_UP_BUMP_MS - 1, 'ID'), nowMs: now, country: 'ID' });
  assert.equal(r.required, false);
  assert.equal(r.bump, true);
});

test('country rules', () => {
  const check = (stored: string | null, current: string | null) =>
    evaluateAdminStepUp({ row: row(now - 60_000, stored), nowMs: now, country: current }).reason;
  assert.equal(check('ID', 'SG'), 'country_changed');
  assert.equal(check('SG', 'SG'), 'ok');
  assert.equal(check('SG', 'ID'), 'country_changed');
  assert.equal(check('ID', null), 'ok');
  assert.equal(check(null, 'SG'), 'country_changed');
  assert.equal(check(null, null), 'ok');
});

test('country change marks OTP required', () => {
  const r = evaluateAdminStepUp({ row: row(now - 60_000, 'SG'), nowMs: now, country: 'ID' });
  assert.equal(r.required, true);
  assert.equal(r.bump, false);
});

test('legacy value is valid and bumps', () => {
  const r = evaluateAdminStepUp({
    row: { value: 'verified', expiresAt: new Date(now + HOUR) },
    nowMs: now,
    country: 'ID',
  });
  assert.equal(r.required, false);
  assert.equal(r.bump, true);
  assert.equal(r.storedCountry, null);
});

test('unparseable value counts as no row', () => {
  const r = evaluateAdminStepUp({
    row: { value: 'garbage:x', expiresAt: new Date(now + HOUR) },
    nowMs: now,
    country: 'ID',
  });
  assert.equal(r.required, true);
  assert.equal(r.reason, 'no_row');
});

test('formatStepUpValue round-trips', () => {
  assert.deepEqual(parseStepUpValue(formatStepUpValue(123, 'SG')), { lastBumpMs: 123, country: 'SG' });
  assert.equal(formatStepUpValue(123, null), 'verified:123:-');
  assert.deepEqual(parseStepUpValue('verified:123:-'), { lastBumpMs: 123, country: null });
  assert.deepEqual(parseStepUpValue('verified'), { lastBumpMs: 0, country: null });
  assert.equal(parseStepUpValue('verified:abc:ID'), null);
});

test('parseGeoCountry handles base64, raw and encoded JSON', () => {
  const json = JSON.stringify({ country: { code: 'sg', name: 'Singapore' } });
  assert.equal(parseGeoCountry(headersOf({ 'x-nf-geo': btoa(json) })), 'SG');
  assert.equal(parseGeoCountry(headersOf({ 'x-nf-geo': json })), 'SG');
  assert.equal(parseGeoCountry(headersOf({ 'x-nf-geo': encodeURIComponent(json) })), 'SG');
  assert.equal(parseGeoCountry(headersOf({ 'x-nf-geo': '%%%' })), null);
  assert.equal(parseGeoCountry(headersOf({ 'x-country': 'id' })), 'ID');
  assert.equal(parseGeoCountry(headersOf({ 'x-nf-geo': '%%%', 'x-country': 'id' })), 'ID');
  assert.equal(parseGeoCountry(headersOf({ 'x-country': 'XX' })), null);
  assert.equal(parseGeoCountry(headersOf({ 'x-country': 'T1' })), null);
  assert.equal(parseGeoCountry(headersOf({ 'x-country': 'ABC' })), null);
  assert.equal(parseGeoCountry(headersOf({})), null);
});

test('safeAdminNextPath rejects off-site paths', () => {
  assert.equal(safeAdminNextPath('/admin/users?page=2'), '/admin/users?page=2');
  assert.equal(safeAdminNextPath('/admin'), '/admin');
  assert.equal(safeAdminNextPath('/admin?denied=1'), '/admin?denied=1');
  for (const bad of [null, undefined, '', '//evil.com', 'https://evil.com/admin', '/dashboard', '/admin/../dashboard', '/adminx', '/admin\\..\\x', '/admin/verify', '/admin/verify?next=%2Fadmin']) {
    assert.equal(safeAdminNextPath(bad), '/admin', String(bad));
  }
});
