import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeTelegramHtml,
  sanitizeTelegramHtml,
  sendTelegramAlert,
  sendOpsAlert,
} from './alert.js';

test('P5-7b: escapeTelegramHtml strictly escapes &, then <, then >', () => {
  // Test basic characters
  assert.equal(escapeTelegramHtml('foo & bar'), 'foo &amp; bar');
  assert.equal(escapeTelegramHtml('x < 10'), 'x &lt; 10');
  assert.equal(escapeTelegramHtml('y > 20'), 'y &gt; 20');

  // Test combination and strict order: if & was not first, &lt; would become &amp;lt;
  assert.equal(escapeTelegramHtml('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  assert.equal(escapeTelegramHtml('<script>alert("x & y")</script>'), '&lt;script&gt;alert("x &amp; y")&lt;/script&gt;');
});

test('P5-7b: sanitizeTelegramHtml preserves allowed Telegram tags and escapes untrusted dynamic content', () => {
  // Keeps intentional allowed tags
  const withTags = '⚠️ <b>PROVIDER ALERT</b>: Provider <code>open-ai</code> error rate is <b>50.0%</b>.';
  assert.equal(sanitizeTelegramHtml(withTags), withTags);

  // Keeps <a> tag with href attribute
  const withLink = '<a href="https://example.com/tx">View Transaction</a>';
  assert.equal(sanitizeTelegramHtml(withLink), withLink);

  // Escapes raw <, >, & in dynamic content around tags
  const dynamicMixed = '[Alert] <b>Payment</b>: user <attacker@test.com> & status "pending > failed"';
  const expected = '[Alert] <b>Payment</b>: user &lt;attacker@test.com&gt; &amp; status "pending &gt; failed"';
  assert.equal(sanitizeTelegramHtml(dynamicMixed), expected);

  // Escapes pure dynamic string without any tags
  const plainWithChars = 'PayPal PAYMENT.CAPTURE.REFUNDED: amount $10 < $20 & reason > timeout';
  const expectedPlain = 'PayPal PAYMENT.CAPTURE.REFUNDED: amount $10 &lt; $20 &amp; reason &gt; timeout';
  assert.equal(sanitizeTelegramHtml(plainWithChars), expectedPlain);
});

test('P5-7b: sendTelegramAlert mocked transport sends escaped HTML and keeps intended tags', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  process.env.ALERT_TELEGRAM_BOT_TOKEN = 'mock-bot-token-123';
  process.env.ALERT_TELEGRAM_CHAT_ID = '987654321';

  let capturedUrl = '';
  let capturedBody: any = null;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    if (init?.body) {
      capturedBody = JSON.parse(init.body as string);
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const rawMessage = '🚨 <b>PAYMENT DISPUTE</b>: PayPal event <EV-1234> & amount > $50';
    await sendTelegramAlert(rawMessage);

    assert.equal(capturedUrl, 'https://api.telegram.org/botmock-bot-token-123/sendMessage');
    assert.ok(capturedBody);
    assert.equal(capturedBody.chat_id, '987654321');
    assert.equal(capturedBody.parse_mode, 'HTML');

    // Asserts <b> is kept, while <EV-1234>, &, > are escaped!
    assert.equal(
      capturedBody.text,
      '🚨 <b>PAYMENT DISPUTE</b>: PayPal event &lt;EV-1234&gt; &amp; amount &gt; $50',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken) process.env.ALERT_TELEGRAM_BOT_TOKEN = originalToken;
    else delete process.env.ALERT_TELEGRAM_BOT_TOKEN;
    if (originalChatId) process.env.ALERT_TELEGRAM_CHAT_ID = originalChatId;
    else delete process.env.ALERT_TELEGRAM_CHAT_ID;
  }
});

test('P5-7b: sendTelegramAlert handles non-2xx Telegram response gracefully without crashing', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  process.env.ALERT_TELEGRAM_BOT_TOKEN = 'mock-bot-token-123';
  process.env.ALERT_TELEGRAM_CHAT_ID = '987654321';

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: can't parse entities" }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    // Should not throw
    await assert.doesNotReject(async () => {
      await sendTelegramAlert('test message');
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken) process.env.ALERT_TELEGRAM_BOT_TOKEN = originalToken;
    else delete process.env.ALERT_TELEGRAM_BOT_TOKEN;
    if (originalChatId) process.env.ALERT_TELEGRAM_CHAT_ID = originalChatId;
    else delete process.env.ALERT_TELEGRAM_CHAT_ID;
  }
});

test('P5-7b: sendOpsAlert delivers sanitized message to Telegram while keeping raw payload for webhook', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.ALERT_TELEGRAM_CHAT_ID;
  const originalWebhook = process.env.ALERT_WEBHOOK_URL;

  process.env.ALERT_TELEGRAM_BOT_TOKEN = 'mock-token';
  process.env.ALERT_TELEGRAM_CHAT_ID = '12345';
  process.env.ALERT_WEBHOOK_URL = 'https://webhook.internal/ops';

  const dispatched: Array<{ url: string; body: any }> = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    dispatched.push({
      url: String(url),
      body: init?.body ? JSON.parse(init.body as string) : null,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const rawMessage = 'Needs review: id=<PAY-1> & reason="timeout > 5s"';
    await sendOpsAlert(rawMessage, { paymentId: 'PAY-1' });

    assert.equal(dispatched.length, 2);

    const telegramCall = dispatched.find((d) => d.url.includes('api.telegram.org'));
    assert.ok(telegramCall);
    assert.equal(
      telegramCall.body.text,
      'Needs review: id=&lt;PAY-1&gt; &amp; reason="timeout &gt; 5s"',
    );

    const webhookCall = dispatched.find((d) => d.url === 'https://webhook.internal/ops');
    assert.ok(webhookCall);
    // Generic webhook receives raw unescaped message & payload
    assert.equal(webhookCall.body.message, rawMessage);
    assert.equal(webhookCall.body.paymentId, 'PAY-1');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken) process.env.ALERT_TELEGRAM_BOT_TOKEN = originalToken;
    else delete process.env.ALERT_TELEGRAM_BOT_TOKEN;
    if (originalChatId) process.env.ALERT_TELEGRAM_CHAT_ID = originalChatId;
    else delete process.env.ALERT_TELEGRAM_CHAT_ID;
    if (originalWebhook) process.env.ALERT_WEBHOOK_URL = originalWebhook;
    else delete process.env.ALERT_WEBHOOK_URL;
  }
});
