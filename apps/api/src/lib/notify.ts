import { db, schema as s } from '@morphic/db';
import { and, eq, isNull } from 'drizzle-orm';
import { sendEmail } from '@morphic/shared/email';
import { processPaymentSuccess } from '@morphic/db/billing';
import { rateLimitStore } from '../ratelimit';

const LOW_BALANCE_CREDITS = Number(process.env.LOW_BALANCE_CREDITS ?? 100_000);
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://morphic-api.web.id';

async function activeUserEmail(userId: string): Promise<string | null> {
  const [u] = await db
    .select({ email: s.users.email })
    .from(s.users)
    .where(and(eq(s.users.id, userId), isNull(s.users.deletedAt)))
    .limit(1);
  return u?.email ?? null;
}

/**
 * Warn once per 24h when the credit balance drops below LOW_BALANCE_CREDITS.
 * Fire-and-forget after settlement; never throws into the request path.
 */
export async function notifyLowBalance(userId: string, sendFn = sendEmail): Promise<boolean> {
  try {
    const [bal] = await db.select({ credits: s.balances.credits }).from(s.balances).where(eq(s.balances.userId, userId));
    const credits = bal?.credits ?? 0;
    if (credits >= LOW_BALANCE_CREDITS) return false;
    // First caller in the 24h window wins; everyone else sees count > 1 and stays quiet.
    if ((await rateLimitStore.increment(`notif:low_balance:${userId}`, 86_400)) !== 1) return false;
    const to = await activeUserEmail(userId);
    if (!to) return false;
    const left = credits.toLocaleString('id-ID');
    await sendFn({
      to,
      subject: 'Saldo kredit Morphic hampir habis',
      text: `Sisa saldo Anda ${left} kredit. Request API akan ditolak (402) saat saldo habis.\n\nIsi ulang: ${appUrl()}/dashboard/billing`,
      html: `<p>Sisa saldo Anda <b>${left} kredit</b>. Request API akan ditolak (402) saat saldo habis.</p><p><a href="${appUrl()}/dashboard/billing">Isi ulang saldo</a></p>`,
    });
    return true;
  } catch (e) {
    console.error('[notify] low balance email failed:', e);
    return false;
  }
}

/** Email the receipt link for a payment that was just marked paid. Never throws. */
export async function notifyPaymentPaid(paymentId: string): Promise<void> {
  try {
    const [p] = await db
      .select({ userId: s.payments.userId, credits: s.payments.credits, amountCents: s.payments.amountCents, currency: s.payments.currency })
      .from(s.payments)
      .where(and(eq(s.payments.id, paymentId), eq(s.payments.status, 'paid')))
      .limit(1);
    if (!p) return;
    const to = await activeUserEmail(p.userId);
    if (!to) return;
    const amount = p.currency === 'USD' ? `$${(p.amountCents / 100).toFixed(2)}` : `Rp ${p.amountCents.toLocaleString('id-ID')}`;
    const url = `${appUrl()}/receipt/${paymentId}`;
    await sendEmail({
      to,
      subject: `Pembayaran Morphic berhasil: ${amount}`,
      text: `Top-up ${amount} berhasil. ${p.credits.toLocaleString('id-ID')} kredit sudah masuk ke akun Anda.\n\nKuitansi: ${url}`,
      html: `<p>Top-up <b>${amount}</b> berhasil. ${p.credits.toLocaleString('id-ID')} kredit sudah masuk ke akun Anda.</p><p><a href="${url}">Lihat kuitansi</a></p>`,
    });
  } catch (e) {
    console.error('[notify] payment receipt email failed:', e);
  }
}

/** processPaymentSuccess outside a caller's transaction, plus the receipt email on first fulfilment. */
export async function fulfilPayment(paymentId: string) {
  const res = await processPaymentSuccess(paymentId);
  if (res.success && !res.alreadyPaid) void notifyPaymentPaid(paymentId);
  return res;
}
