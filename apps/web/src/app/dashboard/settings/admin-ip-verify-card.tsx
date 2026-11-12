'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestAdminIpVerificationCode, verifyAdminIpCode } from '@/lib/actions';

export function AdminIpVerifyCard({ clientIp }: { clientIp: string | null }) {
  const router = useRouter();
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSendCode = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await requestAdminIpVerificationCode();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCodeSent(true);
      setInfo('Kode OTP 6 digit telah dikirim ke email admin Anda (berlaku 10 menit).');
    });
  };

  const handleVerify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const fd = new FormData();
    fd.set('code', code.trim());
    startTransition(async () => {
      const res = await verifyAdminIpCode(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/admin');
      router.refresh();
    });
  };

  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-amber-300 bg-amber-50/90 p-5 text-amber-950 shadow-xs"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-amber-950">
            Verifikasi Alamat IP Baru untuk Panel Admin
          </h2>
          {clientIp && (
            <span className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-mono text-xs text-amber-900">
              IP: {clientIp}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-amber-900">
          Koneksi Anda saat ini menggunakan alamat IP baru yang berbeda dari IP saat login awal.
          Demi mencegah penyalahgunaan cookie sesi dari jaringan lain, verifikasikan IP ini satu
          kali menggunakan kode OTP email. Setelah diverifikasi, IP ini akan dipercaya selama 7 hari.
        </p>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            {info}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSendCode}
            disabled={isPending}
            className="rounded-lg bg-amber-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-amber-800 disabled:opacity-50"
          >
            {isPending && !codeSent
              ? 'Mengirim OTP...'
              : codeSent
                ? 'Kirim Ulang Kode OTP'
                : 'Kirim Kode OTP ke Email'}
          </button>

          {codeSent && (
            <form onSubmit={handleVerify} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 digit OTP"
                aria-label="Kode OTP 6 digit verifikasi IP admin"
                required
                className="w-36 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-mono text-xs tracking-widest text-zinc-900 focus:border-amber-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isPending || code.length !== 6}
                className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {isPending ? 'Memverifikasi...' : 'Verifikasi & Buka /admin'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
