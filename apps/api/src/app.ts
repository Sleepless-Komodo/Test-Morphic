import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { v1 } from './routes/v1';
import { webhooks } from './routes/webhooks';
import { keys } from './routes/keys';
import { account } from './routes/account';
import { payments } from './routes/payments';
import { redeem } from './routes/redeem';

const app = new Hono();

app.use(
  '*',
  cors({
    // Allowed request origin
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    // Allowed headers from FE to BE
    allowHeaders: ['Content-Type', 'Authorization', 'x-internal-secret'],
    // Allowed HTTP methods
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // Expose headers to FE
    exposeHeaders: ['Content-Length'],
    maxAge: 600, // cache preflight 10 minutes
    credentials: true,
  })
);

app.onError((err, c) => {
  console.error('[API Error]:', err);

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return c.json(
    { error: { message: 'Internal Server Error', type: 'internal_error', code: 'internal_error' } },
    500,
  );
});

app.get('/health', (c) => c.json({ ok: true }));
app.route('/webhooks', webhooks);
app.route('/v1/keys', keys);
app.route('/v1/account', account);
app.route('/v1/payments', payments);
app.route('/v1/redeem', redeem);
app.route('/v1', v1);

export { app };
