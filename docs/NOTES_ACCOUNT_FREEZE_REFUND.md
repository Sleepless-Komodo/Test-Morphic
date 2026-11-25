# Catatan: pembekuan akun dan penarikan kredit saat refund

Status: **ditunda, belum diimplementasikan** (dicatat 2026-11-25).

## Yang sudah ada

- Kolom `users.suspended`. Akun suspended ditolak 403 `account_suspended` di `apps/api/src/middleware/auth.ts` (API key) dan `session-auth.ts` (checkout, redeem, key).
- `suspendUser()` di `apps/api/src/lib/payment-state.ts` dan email `notifyAccountSuspended` di `notify.ts`.
- Tombol suspend/unsuspend di halaman admin users, dengan catatan audit.
- Dispute dan reversal PayPal otomatis membekukan akun. Refund biasa hanya mengirim alert.
- Gift card dinonaktifkan otomatis saat payment menjadi `refunded`, `disputed`, atau `needs_review`.

## Keputusan

1. Untuk pembelian kredit saldo, kredit ditarik proporsional dengan jumlah refund.
2. Saldo tidak boleh minus. Bila sisa kredit kurang, tarik yang ada lalu bekukan akun sampai admin memeriksa.
3. Refund yang mata uang atau jumlahnya tidak cocok tetap masuk review manual.
4. Pada dispute, kredit baru ditarik bila pembeli menang.
5. Rilis bertahap: `off`, `shadow` (hitung dan kirim alert saja), lalu `on`.

## Syarat teknis

- Pembelian saldo dilacak lewat ledger `purchase` dengan reference `payment:<id>`.
- Penarikan memakai ledger `refund` bernilai negatif. Reference-nya unik (`ledger_refund_reference_unique`).
- Beberapa refund sebagian dihitung kumulatif, dan webhook ulang tidak menarik lagi.
- Status payment, penarikan kredit, dan pembekuan berada dalam satu transaksi.

## Tetap manual

- Token pack dan unlimited: `entitlements` tidak menyimpan ID payment, jadi perlu migrasi.
- Gift card yang sudah dipakai atau direfund sebagian.
- Refund Duitku.

## Risiko

- Saldo tergabung, jadi kredit dari redeem atau top-up lain bisa ikut tertarik.
- Refund sebagai kompensasi bisa membekukan user yang tidak salah.
- Cache API key default 30 detik, dan request yang sedang berjalan tidak diputus.
- Dashboard web belum memblokir user suspended secara menyeluruh.
- Alasan suspend tidak disimpan di akun.

## Prosedur sementara

1. Alert refund masuk.
2. Admin menarik kredit manual lewat `admin_adjustment`.
3. Admin membekukan akun bila perlu.
