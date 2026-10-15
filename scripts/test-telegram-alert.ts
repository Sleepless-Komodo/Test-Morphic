import { sendOpsAlert } from '../apps/api/src/lib/alert';

async function main() {
  const token = process.env.ALERT_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ALERT_TELEGRAM_CHAT_ID;

  console.log('=== Morphic Telegram Alert Diagnostic Test ===');
  console.log(`ALERT_TELEGRAM_BOT_TOKEN: ${token ? 'Configured (len=' + token.length + ')' : 'MISSING'}`);
  console.log(`ALERT_TELEGRAM_CHAT_ID: ${chatId ? 'Configured' : 'MISSING'}`);

  if (!token || !chatId) {
    console.warn('NOTE: ALERT_TELEGRAM_BOT_TOKEN and ALERT_TELEGRAM_CHAT_ID are not set in current env.');
    console.warn('Set them or run with: node --env-file=.env scripts/test-telegram-alert.ts');
  }

  // Test 1: Plain text alert
  console.log('\n--- Sending Message 1: Plain Text ---');
  try {
    const msg1 = '[Test Alert 1/2] Morphic Payment Ops Alert Test - Plain Message';
    await sendOpsAlert(msg1, { test: 1, type: 'plain' });
    console.log('Message 1 dispatched.');
  } catch (err) {
    console.error('Message 1 dispatch threw error:', err);
  }

  // Test 2: Message containing <b> tags and unescaped <, &, > characters
  console.log('\n--- Sending Message 2: HTML tags with special characters (<, &, >) ---');
  try {
    const msg2 = '[Test Alert 2/2] <b>Morphic Alert</b> with special chars: user input <test-id> & status "pending > failed"';
    await sendOpsAlert(msg2, { test: 2, type: 'special_chars' });
    console.log('Message 2 dispatched.');
  } catch (err) {
    console.error('Message 2 dispatch threw error:', err);
  }

  console.log('\nTest execution finished. Note: If message 2 fails with 400 or logs an error without arriving, see P5-7b.');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
