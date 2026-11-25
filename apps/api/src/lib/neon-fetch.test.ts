import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import {
  createNeonFetch,
  getFallbackConnectionString,
  isNeonFailoverError,
  isReadOnlyBody,
  isReadOnlySql,
  onDbConnectionIssue,
  schema as s,
  type DbConnectionIssue,
} from '@morphic/db';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { createConnectionIssueHandler } from './db-failover-monitor';

const READ = JSON.stringify({ query: 'select 1', params: [] });
const WRITE = JSON.stringify({ query: 'insert into t values ($1)', params: ['1'] });

async function withServer(
  handler: (hit: number, req: http.IncomingMessage, res: http.ServerResponse) => void,
  fn: (url: string, hits: () => number) => Promise<void>,
): Promise<void> {
  let hits = 0;
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => handler(++hits, req, res));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}/sql`, () => hits);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

const post = (body: string): RequestInit => ({ method: 'POST', body, headers: { 'x-test': '1' } });

test('read/write classification is conservative', () => {
  for (const q of ['select 1', ' SELECT a FROM b', '/* c */ select 1', '-- c\nselect 1', 'select 1;']) {
    assert.equal(isReadOnlySql(q), true, q);
  }
  for (const q of [
    'insert into t values (1)',
    'update t set a=1',
    'delete from t',
    'with x as (delete from t returning *) select * from x',
    'select * from t for update',
    'select * from t for no key update skip locked',
    'select * from t for share',
    "select nextval('s')",
    'select pg_advisory_xact_lock(1)',
    'select pg_try_advisory_lock(1)',
    "select set_config('a','b',true)",
    'select * into t2 from t',
    'select 1; delete from t',
    '',
  ]) {
    assert.equal(isReadOnlySql(q), false, q);
  }
  assert.equal(isReadOnlyBody(READ), true);
  assert.equal(isReadOnlyBody(WRITE), false);
  assert.equal(isReadOnlyBody(JSON.stringify({ queries: [{ query: 'select 1' }, { query: 'select 2' }] })), true);
  assert.equal(isReadOnlyBody(JSON.stringify({ queries: [{ query: 'select 1' }, { query: 'delete from t' }] })), false);
  assert.equal(isReadOnlyBody(JSON.stringify({ queries: [] })), false);
  assert.equal(isReadOnlyBody('not json'), false);
  assert.equal(isReadOnlyBody(undefined), false);
});

test('bodies produced by the real Neon driver are classified correctly', async () => {
  const bodies: string[] = [];
  const previous = neonConfig.fetchFunction;
  neonConfig.fetchFunction = async (_u: unknown, init: RequestInit) => {
    bodies.push(String(init.body));
    return new Response(JSON.stringify({ fields: [], rows: [], rowCount: 0, command: 'SELECT', rowAsArray: true }), { status: 200 });
  };
  try {
    const d = drizzle(neon('postgresql://u:p@ep-x.us-east-2.aws.neon.tech/db'));
    await d.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, 'x')).limit(1);
    await d.select({ id: s.users.id }).from(s.users).for('update');
    await d.update(s.users).set({ suspended: true }).where(eq(s.users.email, 'x'));
    await d.delete(s.users).where(eq(s.users.email, 'x'));
  } finally {
    neonConfig.fetchFunction = previous;
  }
  assert.deepEqual(bodies.map(isReadOnlyBody), [true, false, false, false]);
});

test('a write that times out after it was sent reaches the server exactly once', async () => {
  const issues: DbConnectionIssue[] = [];
  const off = onDbConnectionIssue((i) => void issues.push(i));
  try {
    await withServer(
      () => {},
      async (url, hits) => {
        const f = createNeonFetch({ idleTimeoutMs: 80 });
        await assert.rejects(f(url, post(WRITE)), (err: unknown) => isNeonFailoverError(err));
        await new Promise((r) => setTimeout(r, 400));
        assert.equal(hits(), 1);
      },
    );
  } finally {
    off();
  }
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.kind, 'write');
  assert.equal(issues[0]!.attempts, 1);
});

test('a write whose connection drops, before or during the response, is not resent', async () => {
  await withServer(
    (_hit, req) => req.socket.destroy(),
    async (url, hits) => {
      await assert.rejects(createNeonFetch()(url, post(WRITE)));
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(hits(), 1);
    },
  );
  await withServer(
    (_hit, _req, res) => {
      res.writeHead(200, { 'content-length': '100' });
      res.write('partial');
      setTimeout(() => res.destroy(), 20);
    },
    async (url, hits) => {
      await assert.rejects(createNeonFetch()(url, post(WRITE)));
      assert.equal(hits(), 1);
    },
  );
});

test('a read is retried after a drop and gives up after three attempts', async () => {
  await withServer(
    (hit, req, res) => (hit < 3 ? req.socket.destroy() : res.end('{"ok":1}')),
    async (url, hits) => {
      const res = await createNeonFetch()(url, post(READ));
      assert.deepEqual(await res.json(), { ok: 1 });
      assert.equal(hits(), 3);
    },
  );
  await withServer(
    (_hit, req) => req.socket.destroy(),
    async (url, hits) => {
      await assert.rejects(createNeonFetch()(url, post(READ)));
      assert.equal(hits(), 3);
    },
  );
});

test('connection refused and DNS failure are retried for writes too', async () => {
  const probe = net.createServer();
  await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
  const port = (probe.address() as AddressInfo).port;
  await new Promise((r) => probe.close(r));

  for (const url of [`http://127.0.0.1:${port}/`, 'http://nope.invalid/']) {
    const issues: DbConnectionIssue[] = [];
    const off = onDbConnectionIssue((i) => void issues.push(i));
    await assert.rejects(createNeonFetch()(url, post(WRITE)), (err: unknown) => isNeonFailoverError(err));
    await new Promise((r) => setImmediate(r));
    off();
    assert.equal(issues[0]!.attempts, 3, url);
  }
});

test('a TLS handshake that never completes counts as not connected', async () => {
  let sockets = 0;
  const server = net.createServer((sock) => {
    sockets += 1;
    sock.on('error', () => {});
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const open = new Set<net.Socket>();
  server.on('connection', (c) => open.add(c));
  try {
    const url = `https://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    await assert.rejects(createNeonFetch({ connectTimeoutMs: 60 })(url, post(WRITE)));
    assert.equal(sockets, 3);
  } finally {
    open.forEach((c) => c.destroy());
    await new Promise((r) => server.close(r));
  }
});

test('the retry budget is respected and HTTP errors are returned as is', async () => {
  await withServer(
    () => {},
    async (url, hits) => {
      const started = Date.now();
      await assert.rejects(createNeonFetch({ idleTimeoutMs: 200, budgetMs: 350 })(url, post(READ)));
      assert.ok(Date.now() - started < 1_000);
      assert.ok(hits() <= 2);
    },
  );
  for (const status of [402, 429, 503]) {
    await withServer(
      (_hit, _req, res) => {
        res.statusCode = status;
        res.end('{}');
      },
      async (url, hits) => {
        assert.equal((await createNeonFetch()(url, post(READ))).status, status);
        assert.equal(hits(), 1);
      },
    );
  }
});

test('a throwing issue listener does not change the query error', async () => {
  const off = onDbConnectionIssue(() => {
    throw new Error('listener bug');
  });
  try {
    await withServer(
      (_hit, req) => req.socket.destroy(),
      async (url) => {
        await assert.rejects(createNeonFetch()(url, post(WRITE)), (err: Error) => !err.message.includes('listener bug'));
      },
    );
  } finally {
    off();
  }
});

test('connection alerts are throttled and never contain SQL, params or URLs', async () => {
  let t = 0;
  const alerts: string[] = [];
  const logs: string[] = [];
  const push = (m: string) => void logs.push(m);
  const handler = createConnectionIssueHandler({
    now: () => t,
    sendAlert: async (m) => void alerts.push(m),
    log: { info: push, warn: push, error: push },
  });
  const error = new Error('Failed query: insert into sessions\nparams: secret-token', {
    cause: new Error('Connection timeout postgresql://u:pw@h/db'),
  });
  const issue: DbConnectionIssue = { source: 'http', kind: 'write', attempts: 1, error };
  await handler(issue);
  await handler(issue);
  t += 600_001;
  await handler(issue);
  assert.equal(alerts.length, 2);
  assert.equal(logs.length, 3);
  assert.match(alerts[1]!, /\+1 sejak alert terakhir/);
  assert.ok(![...alerts, ...logs].some((m) => /secret-token|u:pw|insert into/.test(m)));
});

test('a loopback fallback is ignored on Vercel only', () => {
  const env = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
  const local = 'postgresql://a:b@127.0.0.1:5432/m';
  assert.equal(getFallbackConnectionString(env({ DATABASE_URL_FALLBACK: local })), local);
  assert.equal(getFallbackConnectionString(env({ DATABASE_URL_FALLBACK: local, VERCEL: '1' })), null);
  const remote = 'postgresql://a:b@db.example.com:5432/m';
  assert.equal(getFallbackConnectionString(env({ DATABASE_URL_FALLBACK: remote, VERCEL: '1' })), remote);
});
