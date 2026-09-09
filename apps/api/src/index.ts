import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { v1 } from './routes/v1.ts';
import { webhooks } from './routes/webhooks.ts';
import { keys } from './routes/keys.ts';
import { account } from './routes/account.ts';
import { db, schema as s } from '@morphic/db';
import { sweepExpiredReservations } from '@morphic/db/billing';
import { lt } from 'drizzle-orm';

const app = new Hono();

app.use('*', cors());

app.onError((err, c) => {
  console.error('[API Error]:', err);
  return c.json(
    { error: { message: err.message || 'Internal Server Error', type: 'internal_error', code: 'internal_error' } },
    500,
  );
});

app.get('/health', (c) => c.json({ ok: true }));
app.route('/v1', v1);
app.route('/webhooks', webhooks);
app.route('/v1/keys', keys);
app.route('/v1/account', account);

const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`morphic api listening on :${info.port}`);
});

// Crash-safety sweep: release reservations that never settled
const sweepInterval = setInterval(() => {
  sweepExpiredReservations()
    .then((n: number) => n > 0 && console.log(`swept ${n} expired reservations`))
    .catch((e: unknown) => console.error('sweep error', e));
}, 60_000);
sweepInterval.unref();

// Log retention purge job: delete request logs older than threshold (default 30 days) every 24h
const LOG_RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS ?? 30);
const purgeInterval = setInterval(() => {
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 86_400_000);
  db.delete(s.requestLogs)
    .where(lt(s.requestLogs.createdAt, cutoff))
    .catch((e: unknown) => console.error('[logger] purge error:', e));
}, 24 * 60 * 60_000);
purgeInterval.unref();
