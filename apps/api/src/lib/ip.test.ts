import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrustedClientIp, isLoopbackIp, trustedProxyHops } from './ip.js';

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

test('H2: TRUSTED_PROXY_HOPS=2 selects 2nd hop from the right', () => {
  const origCf = process.env.TRUST_CF_CONNECTING_IP;
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  try {
    delete process.env.TRUST_CF_CONNECTING_IP;
    process.env.TRUSTED_PROXY_HOPS = '2';
    const c = mockContext({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' });
    assert.equal(getTrustedClientIp(c), '2.2.2.2');
  } finally {
    if (origCf === undefined) delete process.env.TRUST_CF_CONNECTING_IP;
    else process.env.TRUST_CF_CONNECTING_IP = origCf;
    if (origHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = origHops;
  }
});

test('H2: TRUSTED_PROXY_HOPS=0 ignores X-Forwarded-For', () => {
  const origCf = process.env.TRUST_CF_CONNECTING_IP;
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  try {
    delete process.env.TRUST_CF_CONNECTING_IP;
    process.env.TRUSTED_PROXY_HOPS = '0';
    const c = mockContext({ 'x-forwarded-for': '9.9.9.9' });
    assert.equal(getTrustedClientIp(c), 'unknown');
  } finally {
    if (origCf === undefined) delete process.env.TRUST_CF_CONNECTING_IP;
    else process.env.TRUST_CF_CONNECTING_IP = origCf;
    if (origHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = origHops;
  }
});

test('H2: X-Forwarded-For with fewer hops than TRUSTED_PROXY_HOPS is ignored', () => {
  const origCf = process.env.TRUST_CF_CONNECTING_IP;
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  try {
    delete process.env.TRUST_CF_CONNECTING_IP;
    process.env.TRUSTED_PROXY_HOPS = '3';
    const c = mockContext({ 'x-forwarded-for': '1.1.1.1' });
    assert.equal(getTrustedClientIp(c), 'unknown');
  } finally {
    if (origCf === undefined) delete process.env.TRUST_CF_CONNECTING_IP;
    else process.env.TRUST_CF_CONNECTING_IP = origCf;
    if (origHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = origHops;
  }
});

test('H2: invalid TRUSTED_PROXY_HOPS fails closed to 0', () => {
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  try {
    process.env.TRUSTED_PROXY_HOPS = 'abc';
    assert.equal(trustedProxyHops(), 0);
  } finally {
    if (origHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = origHops;
  }
});

test('H2: unset TRUSTED_PROXY_HOPS defaults to 0 in production and 1 in test', () => {
  assert.equal(trustedProxyHops({ NODE_ENV: 'production' }), 0);
  assert.equal(trustedProxyHops({ NODE_ENV: 'test' }), 1);
});

test('H2: production with unset TRUST_CF_CONNECTING_IP and unset hops ignores X-Forwarded-For', () => {
  const origEnv = process.env.NODE_ENV;
  const origCf = process.env.TRUST_CF_CONNECTING_IP;
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.TRUST_CF_CONNECTING_IP;
    delete process.env.TRUSTED_PROXY_HOPS;
    const c = mockContext({ 'x-forwarded-for': '8.8.8.8' });
    assert.equal(getTrustedClientIp(c), 'unknown');
  } finally {
    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
    if (origCf === undefined) delete process.env.TRUST_CF_CONNECTING_IP;
    else process.env.TRUST_CF_CONNECTING_IP = origCf;
    if (origHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = origHops;
  }
});
