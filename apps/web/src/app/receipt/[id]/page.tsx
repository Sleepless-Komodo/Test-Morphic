import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireUser } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

// Printable receipt for a paid top-up. Lives outside /dashboard so the dashboard shell does
// not print. ponytail: browser "Save as PDF" instead of a server PDF; add a PDF renderer if
// receipts need to be emailed as attachments.
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const { locale } = await getServerTranslation();
  const isId = locale === 'id';

  const [row] = await db
    .select({
      id: s.payments.id,
      externalId: s.payments.externalId,
      provider: s.payments.provider,
      amountCents: s.payments.amountCents,
      currency: s.payments.currency,
      credits: s.payments.credits,
      paidAt: s.payments.paidAt,
      createdAt: s.payments.createdAt,
      packageName: s.packages.name,
    })
    .from(s.payments)
    .leftJoin(s.packages, eq(s.packages.id, s.payments.packageId))
    .where(and(eq(s.payments.id, id), eq(s.payments.userId, user.id), eq(s.payments.status, 'paid')))
    .limit(1);
  if (!row) notFound();

  const paidAt = row.paidAt ?? row.createdAt;
  const amount =
    row.currency === 'USD'
      ? `$${(row.amountCents / 100).toFixed(2)} USD`
      : `Rp ${row.amountCents.toLocaleString('id-ID')}`;
  const lines: Array<[string, string]> = [
    [isId ? 'Nomor kuitansi' : 'Receipt number', row.id.slice(0, 8).toUpperCase()],
    [isId ? 'Tanggal bayar' : 'Paid on', paidAt.toLocaleString(isId ? 'id-ID' : 'en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }) + ' WIB'],
    [isId ? 'Ditagihkan kepada' : 'Billed to', `${user.name ?? ''} <${user.email}>`.trim()],
    [isId ? 'Paket' : 'Package', row.packageName ?? (isId ? 'Isi ulang kredit' : 'Credit top-up')],
    [isId ? 'Kredit' : 'Credits', row.credits.toLocaleString(isId ? 'id-ID' : 'en-US')],
    [isId ? 'Metode bayar' : 'Payment method', row.provider === 'paypal' ? 'PayPal' : row.provider === 'duitku' ? 'Duitku' : row.provider],
    [isId ? 'ID transaksi gateway' : 'Gateway transaction ID', row.externalId],
  ];

  return (
    <main className="min-h-screen bg-neutral-100 print:bg-white px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex justify-end print:hidden">
          <PrintButton label={isId ? 'Cetak / Simpan PDF' : 'Print / Save as PDF'} />
        </div>
        <article className="rounded-2xl bg-white border border-neutral-200 p-6 sm:p-10 print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-6">
            <div>
              <p className="font-heading text-xl font-extrabold text-neutral-950">Morphic</p>
              <p className="text-xs text-neutral-600">{isId ? 'Kuitansi pembayaran' : 'Payment receipt'}</p>
            </div>
            <p className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
              {isId ? 'LUNAS' : 'PAID'}
            </p>
          </header>

          <dl className="divide-y divide-neutral-100 text-sm">
            {lines.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-6">
                <dt className="text-neutral-600">{k}</dt>
                <dd className="font-medium text-neutral-950 break-all sm:text-right">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-2 flex items-baseline justify-between border-t-2 border-neutral-950 pt-4">
            <span className="text-sm font-bold text-neutral-950">{isId ? 'Total dibayar' : 'Total paid'}</span>
            <span className="font-mono text-lg font-bold text-neutral-950">{amount}</span>
          </div>
        </article>
      </div>
    </main>
  );
}
