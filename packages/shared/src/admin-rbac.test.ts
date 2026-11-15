import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_ADMIN_PERMISSIONS,
  adminIpNetworkKey,
  canonicalizeAdminIp,
  evaluateAdminIpAccess,
  extractTrustedAdminIp,
  hasAdminPermission,
  isAdminIpAllowed,
  isAdminRole,
  isSameAdminIpOrIpv6Prefix,
  isSuperAdminRole,
} from './admin-rbac.ts';

test('RBAC: role recognition and super-admin checks', () => {
  assert.equal(isAdminRole('user'), false);
  assert.equal(isAdminRole(null), false);
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('super_admin'), true);
  assert.equal(isAdminRole('finance'), true);
  assert.equal(isAdminRole('support'), true);
  assert.equal(isAdminRole('security'), true);

  assert.equal(isSuperAdminRole('admin'), true);
  assert.equal(isSuperAdminRole('super_admin'), true);
  assert.equal(isSuperAdminRole('finance'), false);
});

test('RBAC: least-privilege permission matrix per admin role', () => {
  for (const perm of ALL_ADMIN_PERMISSIONS) {
    assert.equal(hasAdminPermission('admin', perm), true);
    assert.equal(hasAdminPermission('super_admin', perm), true);
    assert.equal(hasAdminPermission('user', perm), false);
  }

  // Finance can manage billing/packages/codes, cannot delete users or edit provider catalog
  assert.equal(hasAdminPermission('finance', 'finance:write'), true);
  assert.equal(hasAdminPermission('finance', 'codes:write'), true);
  assert.equal(hasAdminPermission('finance', 'users:delete'), false);
  assert.equal(hasAdminPermission('finance', 'users:role'), false);
  assert.equal(hasAdminPermission('finance', 'catalog:write'), false);

  // Support can read/suspend users and post announcements, cannot grant credits or delete users
  assert.equal(hasAdminPermission('support', 'users:read'), true);
  assert.equal(hasAdminPermission('support', 'users:write'), true);
  assert.equal(hasAdminPermission('support', 'announcements:write'), true);
  assert.equal(hasAdminPermission('support', 'finance:write'), false);
  assert.equal(hasAdminPermission('support', 'users:delete'), false);
  assert.equal(hasAdminPermission('support', 'catalog:write'), false);

  // Security can inspect audit/alerts/keys and suspend compromised accounts, cannot mint credits
  assert.equal(hasAdminPermission('security', 'security:read'), true);
  assert.equal(hasAdminPermission('security', 'users:write'), true);
  assert.equal(hasAdminPermission('security', 'finance:write'), false);
  assert.equal(hasAdminPermission('security', 'codes:write'), false);
});

test('IP allowlist: unset allows all; configured enforces exact IP, CIDR, IPv6, and fails closed', () => {
  assert.equal(isAdminIpAllowed('unknown', undefined), true);
  assert.equal(isAdminIpAllowed('unknown', '   '), true);

  const allowlist = '203.0.113.10, 10.20.0.0/16, 2001:db8:abcd::/48';
  assert.equal(isAdminIpAllowed('203.0.113.10', allowlist), true);
  assert.equal(isAdminIpAllowed('::ffff:203.0.113.10', allowlist), true);
  assert.equal(isAdminIpAllowed('203.0.113.11', allowlist), false);
  assert.equal(isAdminIpAllowed('10.20.99.254', allowlist), true);
  assert.equal(isAdminIpAllowed('10.21.0.1', allowlist), false);
  assert.equal(isAdminIpAllowed('2001:db8:abcd:1::42', allowlist), true);
  assert.equal(isAdminIpAllowed('2001:db8:ffff::1', allowlist), false);
  assert.equal(isAdminIpAllowed('unknown', allowlist), false);
  assert.equal(isAdminIpAllowed('', allowlist), false);
});

test('extractTrustedAdminIp: uses rightmost XFF hop unless CF header explicitly trusted', () => {
  const h = new Headers({
    'cf-connecting-ip': '198.51.100.9',
    'x-forwarded-for': '203.0.113.10, 192.0.2.55',
  });
  // Attacker-forged left XFF and untrusted CF header are ignored
  assert.equal(extractTrustedAdminIp(h, {}), '192.0.2.55');
  assert.equal(extractTrustedAdminIp(h, { TRUST_CF_CONNECTING_IP: '1' }), '198.51.100.9');
});

test('Step-Up OTP IP evaluation (Opsi 1): allows login IP & trusted IPs, challenges changed IP without lockout', () => {
  assert.equal(canonicalizeAdminIp('::ffff:114.10.20.30'), '114.10.20.30');

  // 1) Localhost / unknown in dev -> allowed without prompt
  assert.equal(
    evaluateAdminIpAccess({ clientIp: 'unknown', sessionIp: null }).status,
    'allowed',
  );
  assert.equal(
    evaluateAdminIpAccess({ clientIp: '127.0.0.1', sessionIp: '127.0.0.1' }).status,
    'allowed',
  );

  // 2) Same public IP as login session -> allowed immediately
  assert.equal(
    evaluateAdminIpAccess({ clientIp: '114.10.20.30', sessionIp: '::ffff:114.10.20.30' }).status,
    'allowed',
  );

  // 3) Admin changes Wi-Fi / ISP IP (or attacker uses stolen cookie from new IP) -> step_up_required
  const changed = evaluateAdminIpAccess({
    clientIp: '182.1.2.3',
    sessionIp: '114.10.20.30',
  });
  assert.equal(changed.status, 'step_up_required');
  assert.equal(changed.reason, 'ip_changed_needs_otp');

  // 4) Once new IP is verified via Email OTP (in trustedIps) -> allowed!
  const verified = evaluateAdminIpAccess({
    clientIp: '182.1.2.3',
    sessionIp: '114.10.20.30',
    trustedIps: ['182.1.2.3'],
  });
  assert.equal(verified.status, 'allowed');
  assert.equal(verified.reason, 'step_up_trusted');

  // 5) With ADMIN_ALLOWED_IPS set: outside allowlist triggers step_up_required by default (or denied if strict)
  assert.equal(
    evaluateAdminIpAccess({
      clientIp: '182.1.2.3',
      sessionIp: '182.1.2.3',
      allowlistRaw: '203.0.113.0/24',
    }).status,
    'step_up_required',
  );
  assert.equal(
    evaluateAdminIpAccess({
      clientIp: '182.1.2.3',
      sessionIp: '182.1.2.3',
      allowlistRaw: '203.0.113.0/24',
      strictAllowlist: true,
    }).status,
    'denied',
  );

  // 6) IPv6 /64 prefix matching: Better Auth zero-padded /64 sessionIp matches full /128 clientIp on same network
  assert.equal(
    isSameAdminIpOrIpv6Prefix(
      '2001:db8:abcd:1:9999:8888:7777:6666',
      '2001:0db8:abcd:0001:0000:0000:0000:0000',
    ),
    true,
  );
  assert.equal(
    evaluateAdminIpAccess({
      clientIp: '2001:db8:abcd:1:9999:8888:7777:6666',
      sessionIp: '2001:0db8:abcd:0001:0000:0000:0000:0000',
    }).status,
    'allowed',
  );

  // 7) Different IPv6 /64 prefix triggers step_up_required
  assert.equal(
    evaluateAdminIpAccess({
      clientIp: '2001:db8:abcd:2::1',
      sessionIp: '2001:0db8:abcd:0001:0000:0000:0000:0000',
    }).status,
    'step_up_required',
  );
});

test('Admin IP: trusted-IP key covers the whole IPv6 /64', () => {
  assert.equal(adminIpNetworkKey('203.0.113.7'), '203.0.113.7');
  assert.equal(adminIpNetworkKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(adminIpNetworkKey('unknown'), null);
  const key = adminIpNetworkKey('2001:db8:abcd:1:9999:8888:7777:6666');
  assert.equal(key, adminIpNetworkKey('2001:0db8:abcd:0001::42'));
  // A rotated privacy address on the same /64 is trusted; another /64 is not.
  const evalWith = (clientIp: string) =>
    evaluateAdminIpAccess({ clientIp, sessionIp: '198.51.100.1', trustedIps: [key!] }).status;
  assert.equal(evalWith('2001:db8:abcd:1::beef'), 'allowed');
  assert.equal(evalWith('2001:db8:abcd:2::beef'), 'step_up_required');
});
