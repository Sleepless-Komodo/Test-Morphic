import { db, schema as s } from '@morphic/db';
import { and, eq, isNull } from 'drizzle-orm';
import { sendEmail } from '@morphic/shared/email';
import { BALANCE_CREDITS_PER_IDR } from '@morphic/shared/credits';
import { processPaymentSuccess } from '@morphic/db/billing';
import { rateLimitStore } from '../ratelimit';
import { scheduleTargetedSync } from './db-sync-queue';

/** Default 10,000,000 credits = Rp 5.000 (at BALANCE_CREDITS_PER_IDR = 2,000), ~25% of the minimum Rp 20.000 top-up pack. */
export const DEFAULT_LOW_BALANCE_CREDITS = 10_000_000;
const lowBalanceThreshold = () => Number(process.env.LOW_BALANCE_CREDITS ?? DEFAULT_LOW_BALANCE_CREDITS);
const formatBalanceIdr = (credits: number) =>
  `Rp ${Math.floor(Math.max(0, credits) / BALANCE_CREDITS_PER_IDR).toLocaleString('id-ID')}`;
const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
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
    if (credits >= lowBalanceThreshold()) return false;
    // First caller in the 24h window wins; everyone else sees count > 1 and stays quiet.
    if ((await rateLimitStore.increment(`notif:low_balance:${userId}`, 86_400)) !== 1) return false;
    const to = await activeUserEmail(userId);
    if (!to) return false;
    const idrLeft = formatBalanceIdr(credits);
    const left = credits.toLocaleString('id-ID');
    await sendFn({
      to,
      subject: 'Saldo Morphic hampir habis',
      text: `Sisa saldo Anda tinggal sekitar ${idrLeft} (${left} kredit). Request API akan ditolak (402) saat saldo habis.\n\nIsi ulang: ${appUrl()}/dashboard/billing`,
      html: `<p>Sisa saldo Anda tinggal sekitar <b>${idrLeft}</b> (${left} kredit). Request API akan ditolak (402) saat saldo habis.</p><p><a href="${appUrl()}/dashboard/billing">Isi ulang saldo</a></p>`,
    });
    return true;
  } catch (e) {
    console.error('[notify] low balance email failed:', e);
    return false;
  }
}

/**
 * Security notification when an API key is revoked/deleted (AC-NOT-01 / FIX-P0-02).
 * Never throws into the caller.
 */
export async function notifyKeyRevoked(
  userId: string,
  keyInfo: { name: string; keyPrefix: string },
  sendFn = sendEmail,
): Promise<boolean> {
  try {
    const to = await activeUserEmail(userId);
    if (!to) return false;
    const safeName = escapeHtml(keyInfo.name);
    const safePrefix = escapeHtml(keyInfo.keyPrefix);
    const keysUrl = `${appUrl()}/dashboard/keys`;
    await sendFn({
      to,
      subject: `API key Morphic dicabut: ${keyInfo.name} (${keyInfo.keyPrefix}...)`,
      text: `API key "${keyInfo.name}" (${keyInfo.keyPrefix}...) baru saja dicabut/dihapus dari akun Morphic Anda.\n\nJika ini bukan Anda, segera periksa keamanan akun dan cabut sesi lain di: ${keysUrl}`,
      html: `<p>API key <b>${safeName}</b> (<code>${safePrefix}...</code>) baru saja dicabut/dihapus dari akun Morphic Anda.</p><p>Jika ini bukan Anda, segera periksa keamanan akun di <a href="${keysUrl}">Dashboard API Keys</a>.</p>`,
    });
    return true;
  } catch (e) {
    console.error('[notify] key revoked email failed:', e);
    return false;
  }
}

/**
 * Notification when a user account is suspended (AC-NOT-01 / FIX-P0-02).
 * Never throws into the caller.
 */
export async function notifyAccountSuspended(
  userId: string,
  reason?: string,
  sendFn = sendEmail,
): Promise<boolean> {
  try {
    const to = await activeUserEmail(userId);
    if (!to) return false;
    const reasonText = reason ? `\nAlasan: ${reason}` : '';
    const reasonHtml = reason ? `<p>Alasan: <b>${escapeHtml(reason)}</b></p>` : '';
    await sendFn({
      to,
      subject: 'Akun Morphic Anda ditangguhkan (suspended)',
      text: `Akun Morphic Anda telah ditangguhkan sementara sehingga akses API key dan dashboard dihentikan.${reasonText}\n\nJika Anda merasa ini adalah kekeliruan atau ingin mengajukan klarifikasi, hubungi tim dukungan kami di support@morphic.id.`,
      html: `<p>Akun Morphic Anda telah <b>ditangguhkan sementara</b> sehingga akses API key dan dashboard dihentikan.</p>${reasonHtml}<p>Jika Anda merasa ini adalah kekeliruan atau ingin mengajukan klarifikasi, hubungi tim dukungan kami di <a href="mailto:support@morphic.id">support@morphic.id</a>.</p>`,
    });
    return true;
  } catch (e) {
    console.error('[notify] account suspended email failed:', e);
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

    const [gift] = await db
      .select({ recipientEmail: s.giftCards.recipientEmail, code: s.redeemCodes.code })
      .from(s.giftCards)
      .innerJoin(s.redeemCodes, eq(s.redeemCodes.id, s.giftCards.redeemCodeId))
      .where(eq(s.giftCards.paymentId, paymentId))
      .limit(1);
    if (gift) {
      const credits = p.credits.toLocaleString('id-ID');
      const redeemUrl = `${appUrl()}/dashboard/redeem`;
      await sendEmail({
        to,
        subject: `Gift card Morphic siap: ${amount}`,
        text: `Pembelian gift card ${amount} berhasil. Kode (${credits} kredit, sekali pakai): ${gift.code}\n\nKuitansi: ${url}`,
        html: `<p>Pembelian gift card <b>${amount}</b> berhasil.</p><p>Kode (${credits} kredit, sekali pakai): <b>${gift.code}</b></p><p><a href="${url}">Lihat kuitansi</a></p>`,
      });
      if (gift.recipientEmail) {
        await sendEmail({
          to: gift.recipientEmail,
          subject: 'Kamu dapat gift card Morphic',
          text: `${to} mengirim gift card Morphic senilai ${credits} kredit.\n\nKode: ${gift.code}\nTukarkan di ${redeemUrl}`,
          html: `<p>${escapeHtml(to)} mengirim gift card Morphic senilai <b>${credits} kredit</b>.</p><p>Kode: <b>${gift.code}</b></p><p><a href="${redeemUrl}">Tukarkan kode</a></p>`,
        });
      }
      return;
    }

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
  if (res.success) scheduleTargetedSync({ paymentId });
  return res;
}
