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

test('P5-7b: sendTelegramAlert with isHtmlFormatted: true preserves allowed tags and escapes dynamic characters', async () => {
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
    const templateMessage = '⚠️ <b>PROVIDER ALERT</b>: Provider <code>open-ai</code> failed with <err-code> & rate > 50%';
    await sendTelegramAlert(templateMessage, { isHtmlFormatted: true });

    assert.equal(capturedUrl, 'https://api.telegram.org/botmock-bot-token-123/sendMessage');
    assert.ok(capturedBody);
    assert.equal(capturedBody.chat_id, '987654321');
    assert.equal(capturedBody.parse_mode, 'HTML');

    // Asserts <b> and <code> are kept, while <err-code>, &, > are escaped!
    assert.equal(
      capturedBody.text,
      '⚠️ <b>PROVIDER ALERT</b>: Provider <code>open-ai</code> failed with &lt;err-code&gt; &amp; rate &gt; 50%',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken) process.env.ALERT_TELEGRAM_BOT_TOKEN = originalToken;
    else delete process.env.ALERT_TELEGRAM_BOT_TOKEN;
    if (originalChatId) process.env.ALERT_TELEGRAM_CHAT_ID = originalChatId;
    else delete process.env.ALERT_TELEGRAM_CHAT_ID;
  }
});

test('P5-7b: sendTelegramAlert defaults to full escaping (no HTML whitelist)', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  process.env.ALERT_TELEGRAM_BOT_TOKEN = 'mock-bot-token-123';
  process.env.ALERT_TELEGRAM_CHAT_ID = '987654321';

  let capturedBody: any = null;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (init?.body) {
      capturedBody = JSON.parse(init.body as string);
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: 43 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const rawMessage = 'Payment dispute: user injected <a href="evil.com">click</a> and <b>unclosed tag';
    await sendTelegramAlert(rawMessage);

    assert.ok(capturedBody);
    assert.equal(capturedBody.chat_id, '987654321');
    assert.equal(capturedBody.parse_mode, 'HTML');
    // ALL tags escaped into character entities: no tag whitelist!
    assert.equal(
      capturedBody.text,
      'Payment dispute: user injected &lt;a href="evil.com"&gt;click&lt;/a&gt; and &lt;b&gt;unclosed tag',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken) process.env.ALERT_TELEGRAM_BOT_TOKEN = originalToken;
    else delete process.env.ALERT_TELEGRAM_BOT_TOKEN;
    if (originalChatId) process.env.ALERT_TELEGRAM_CHAT_ID = originalChatId;
    else delete process.env.ALERT_TELEGRAM_CHAT_ID;
  }
});

test('P5-7b: sendTelegramAlert retries once as plain text without parse_mode when Telegram responds 400', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  process.env.ALERT_TELEGRAM_BOT_TOKEN = 'mock-bot-token-123';
  process.env.ALERT_TELEGRAM_CHAT_ID = '987654321';

  const fetchCalls: Array<{ url: string; body: any }> = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const parsedBody = init?.body ? JSON.parse(init.body as string) : null;
    fetchCalls.push({ url: String(url), body: parsedBody });

    // First call (with parse_mode) simulates a Telegram entity parsing error
    if (fetchCalls.length === 1) {
      return new Response(
        JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: can't parse entities: unclosed tag" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Second call (retry) succeeds
    return new Response(JSON.stringify({ ok: true, result: { message_id: 44 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const rawMessage = 'Alert with broken formatting: <b unmatched tag';
    await sendTelegramAlert(rawMessage, { isHtmlFormatted: true });

    // Must have made 2 calls: the initial HTML attempt, followed by the plain text retry
    assert.equal(fetchCalls.length, 2, 'Must perform immediate fallback retry on 400');

    // First call had parse_mode HTML
    assert.equal(fetchCalls[0].body.parse_mode, 'HTML');

    // Second call (retry) must NOT have parse_mode, sending raw plain text
    assert.equal(fetchCalls[1].body.parse_mode, undefined, 'Retry must omit parse_mode');
    assert.equal(fetchCalls[1].body.text, rawMessage, 'Retry must carry full uncorrupted message');
    assert.equal(fetchCalls[1].body.chat_id, '987654321');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken) process.env.ALERT_TELEGRAM_BOT_TOKEN = originalToken;
    else delete process.env.ALERT_TELEGRAM_BOT_TOKEN;
    if (originalChatId) process.env.ALERT_TELEGRAM_CHAT_ID = originalChatId;
    else delete process.env.ALERT_TELEGRAM_CHAT_ID;
  }
});

test('P5-7b: sendOpsAlert delivers fully-escaped message to Telegram and raw payload to webhook', async () => {
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
    const rawMessage = 'Needs review: id=<PAY-1> & reason="timeout > 5s" & user="<b>alice</b>"';
    await sendOpsAlert(rawMessage, { paymentId: 'PAY-1' });

    assert.equal(dispatched.length, 2);

    const telegramCall = dispatched.find((d) => d.url.includes('api.telegram.org'));
    assert.ok(telegramCall);
    // Verified 100% full escape: even <b>alice</b> is escaped to &lt;b&gt;alice&lt;/b&gt;
    assert.equal(
      telegramCall.body.text,
      'Needs review: id=&lt;PAY-1&gt; &amp; reason="timeout &gt; 5s" &amp; user="&lt;b&gt;alice&lt;/b&gt;"',
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
