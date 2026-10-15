import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrustedClientIp, isLoopbackIp } from './ip.js';

function mockContext(headers: Record<string, string>): any {
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()] ?? headers[name],
    },
  };
}

test('P5-5: spoofed cf-connecting-ip is ignored by default when TRUST_CF_CONNECTING_IP is unset or not 1', () => {
  delete process.env.TRUST_CF_CONNECTING_IP;

  const c = mockContext({
    'cf-connecting-ip': '1.2.3.4',
    'x-forwarded-for': '5.6.7.8',
  });

  // Since TRUST_CF_CONNECTING_IP is off, cf-connecting-ip is ignored; last xff hop is used
  const ip = getTrustedClientIp(c);
  assert.equal(ip, '5.6.7.8');
});

test('P5-5: cf-connecting-ip is accepted only when TRUST_CF_CONNECTING_IP === "1"', () => {
  process.env.TRUST_CF_CONNECTING_IP = '1';

  const c = mockContext({
    'cf-connecting-ip': '1.2.3.4',
    'x-forwarded-for': '5.6.7.8',
  });

  const ip = getTrustedClientIp(c);
  assert.equal(ip, '1.2.3.4');

  delete process.env.TRUST_CF_CONNECTING_IP;
});

test('P5-5: extracts the last X-Forwarded-For hop correctly', () => {
  delete process.env.TRUST_CF_CONNECTING_IP;

  const c1 = mockContext({
    'x-forwarded-for': '10.0.0.1, 192.168.1.1, 203.0.113.195',
  });
  assert.equal(getTrustedClientIp(c1), '203.0.113.195');

  const c2 = mockContext({
    'x-forwarded-for': '10.0.0.1, 198.51.100.22',
  });
  assert.equal(getTrustedClientIp(c2), '198.51.100.22');
});

test('P5-5: isLoopbackIp correctly identifies loopback hosts', () => {
  assert.equal(isLoopbackIp('127.0.0.1'), true);
  assert.equal(isLoopbackIp('::1'), true);
  assert.equal(isLoopbackIp('localhost'), true);
  assert.equal(isLoopbackIp('192.168.1.1'), false);
  assert.equal(isLoopbackIp('173.0.81.1'), false);
  assert.equal(isLoopbackIp('unknown'), false);
});
