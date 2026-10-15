import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTestDatabaseAllowed,
  getDatabaseHost,
  isHostAllowed,
  DEFAULT_ALLOWED_HOSTS,
} from './test-guard.js';

test('test-guard: getDatabaseHost extracts host correctly', () => {
  assert.equal(getDatabaseHost('postgresql://user:pass@localhost:5432/db'), 'localhost');
  assert.equal(getDatabaseHost('postgresql://user:pass@127.0.0.1:5432/db'), '127.0.0.1');
  assert.equal(getDatabaseHost('postgresql://user:pass@[::1]:5432/db'), '::1');
  assert.equal(
    getDatabaseHost('postgresql://user:pass@ep-test-branch.us-east-2.aws.neon.tech/neondb'),
    'ep-test-branch.us-east-2.aws.neon.tech',
  );
  assert.equal(getDatabaseHost('not-a-valid-url'), null);
  assert.equal(getDatabaseHost(undefined), null);
});

test('test-guard: isHostAllowed checks default and extra hosts', () => {
  for (const host of DEFAULT_ALLOWED_HOSTS) {
    assert.equal(isHostAllowed(host), true, `default host ${host} should be allowed`);
  }

  assert.equal(isHostAllowed('ep-prod.neon.tech'), false);
  assert.equal(isHostAllowed('remote-db.example.com'), false);

  // Extra hosts from TEST_DB_HOST_ALLOWLIST
  const extra = 'ep-branch-1.neon.tech, ep-branch-2.neon.tech';
  assert.equal(isHostAllowed('ep-branch-1.neon.tech', extra), true);
  assert.equal(isHostAllowed('ep-branch-2.neon.tech', extra), true);
  assert.equal(isHostAllowed('ep-prod.neon.tech', extra), false);
});

test('test-guard: rejects production NODE_ENV', () => {
  assert.throws(
    () => {
      assertTestDatabaseAllowed({
        NODE_ENV: 'production',
        ALLOW_TEST_DB_WRITE: '1',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      });
    },
    { message: /NODE_ENV is set to "production"/ },
  );
});

test('test-guard: rejects missing or invalid ALLOW_TEST_DB_WRITE flag', () => {
  assert.throws(
    () => {
      assertTestDatabaseAllowed({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      });
    },
    { message: /ALLOW_TEST_DB_WRITE must be set to "1"/ },
  );

  assert.throws(
    () => {
      assertTestDatabaseAllowed({
        NODE_ENV: 'test',
        ALLOW_TEST_DB_WRITE: '0',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      });
    },
    { message: /ALLOW_TEST_DB_WRITE must be set to "1"/ },
  );
});

test('test-guard: rejects non-allowlisted production-like host even with flag set', () => {
  assert.throws(
    () => {
      assertTestDatabaseAllowed({
        NODE_ENV: 'test',
        ALLOW_TEST_DB_WRITE: '1',
        DATABASE_URL: 'postgresql://user:pass@ep-jolly-paper-aekoqy1c-pooler.c-2.us-east-2.aws.neon.tech/neondb',
      });
    },
    { message: /DATABASE_URL host \(.*\) is not in allowlist/ },
  );
});

test('test-guard: accepts allowlisted host with ALLOW_TEST_DB_WRITE=1', () => {
  assert.doesNotThrow(() => {
    assertTestDatabaseAllowed({
      NODE_ENV: 'test',
      ALLOW_TEST_DB_WRITE: '1',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
    });
  });

  assert.doesNotThrow(() => {
    assertTestDatabaseAllowed({
      NODE_ENV: 'test',
      ALLOW_TEST_DB_WRITE: '1',
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/test',
    });
  });

  assert.doesNotThrow(() => {
    assertTestDatabaseAllowed({
      NODE_ENV: 'test',
      ALLOW_TEST_DB_WRITE: '1',
      TEST_DB_HOST_ALLOWLIST: 'ep-test-branch.neon.tech',
      DATABASE_URL: 'postgresql://user:pass@ep-test-branch.neon.tech/neondb',
    });
  });
});
