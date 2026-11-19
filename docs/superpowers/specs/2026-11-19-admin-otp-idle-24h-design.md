# OTP Panel Admin: idle 24 jam + pop-up

Tanggal: 2026-11-19. Ukuran: perubahan kecil (desain singkat).

## Kenapa

Admin (contoh: super_admin yang login via Google) diminta OTP email berulang kali saat pindah
dari dashboard biasa ke panel admin. Pemicunya sekarang adalah "IP berubah"
(`adminCheck` di `apps/web/src/lib/actions.ts`). Di Netlify, IP yang terbaca kemungkinan besar
bukan IP asli user (diambil dari entry paling kanan `x-forwarded-for`), jadi OTP muncul acak.
Selain itu, OTP-nya lewat redirect ke `/dashboard/settings?admin_ip=verify`, yang memutus alur kerja.

## Tujuan

- Admin cukup OTP sekali, lalu tidak ditanya lagi selama masih aktif di panel admin.
- OTP diminta lagi hanya kalau panel admin tidak dipakai lebih dari 24 jam.
- OTP muncul sebagai pop-up di panel admin, bukan redirect ke halaman settings.

## Bukan tujuan

- Tidak mengubah OTP login user biasa (email+password) maupun alur login.
- Tidak ada step-up khusus untuk aksi berbahaya (dibahas, lalu dibatalkan supaya tidak ribet).
- Tidak ada batas mutlak 7 hari (dibahas, dibatalkan).
- Tidak ada migrasi DB.

## Pendekatan yang dipertimbangkan

1. Aturan 24 jam + step-up 1-2 jam untuk aksi berbahaya (berdasarkan permission atau daftar aksi).
   Dibatalkan: terlalu ribet untuk kebutuhan sekarang.
2. **Dipilih:** aturan idle 24 jam saja, pemicu IP dibuang, OTP lewat pop-up.

## Aturan

- Penanda verifikasi per sesi tetap memakai row `verifications` dengan identifier
  `admin-verified-session:<sessionId>`.
- `expiresAt` row = aktivitas admin terakhir + 24 jam. Setiap aktivitas di panel admin
  (render halaman `/admin/*` atau server action admin) memperpanjangnya.
- Supaya tidak menulis ke DB di setiap navigasi, perpanjangan hanya ditulis kalau perpanjangan
  terakhir sudah lebih dari 5 menit lalu. Akibatnya batas efektif 23 jam 55 menit sampai 24 jam,
  dan itu tidak masalah.
- Row hilang atau kedaluwarsa berarti OTP wajib. Logout atau sesi berakhir juga berarti OTP lagi
  di sesi berikutnya, karena row-nya terikat ke session ID.
- Pemicu "IP berubah" dan row `admin-trusted-ip:*` dihapus dari alur.

### Cek negara

- Saat OTP berhasil, kode negara request (ISO alpha-2) ikut disimpan di row penanda.
- OTP wajib lagi kalau negara request sekarang terdeteksi **dan** berbeda dari negara yang
  tersimpan (negara tersimpan kosong dihitung berbeda). Ini termasuk pulang ke Indonesia
  (SG ke ID minta OTP), supaya cookie yang dicuri di luar negeri tidak bisa dipakai dari
  Indonesia tanpa OTP. Setelah verifikasi di negara baru, aturan idle 24 jam berlaku seperti
  biasa. Aturan idle 24 jam selalu berlaku di negara mana pun.
- Sumber negara: header geo dari Netlify (`x-nf-geo`, base64 JSON berisi `country.code`, dengan
  `x-country` sebagai cadangan). Header ini harus dibaca dari request asli. Header yang di-set
  middleware (`x-morphic-country`) tidak boleh dipakai karena jatuh ke `US` kalau header geo tidak
  ada.
- Negara tidak terdeteksi berarti cek negara dilewati (fail open) dan `console.warn` dicatat,
  supaya admin tidak terkunci dalam loop OTP kalau header ternyata tidak sampai.
- Belum terverifikasi dari kode: setelah deploy, pastikan sekali bahwa header geo Netlify benar
  sampai ke server action / server component.
- Yang tetap dipertahankan:
  - `ADMIN_ALLOWED_IPS` + `ADMIN_IP_ENFORCEMENT=strict` (hard deny, opt-in lewat env).
  - Cek `mfaMissing` untuk admin yang login dengan password.
  - Pembatasan kode OTP yang sudah ada: berlaku 10 menit, maksimal 5 percobaan, jeda kirim ulang
    60 detik.

## Pop-up

- Kalau OTP dibutuhkan, layout `/admin` tidak me-render data panel. Sebagai gantinya muncul
  pop-up OTP di atas shell admin: tombol kirim kode ke email, input 6 digit, dan pesan error.
  Setelah kode benar, halaman di-refresh dan panel tampil.
- Kalau server action admin ditolak karena penanda sudah kedaluwarsa (misalnya tab dibiarkan
  terbuka lebih dari 24 jam), pop-up yang sama muncul. Aksinya tidak diulang otomatis; admin
  menekan tombolnya lagi setelah verifikasi.
- Redirect ke `/dashboard/settings?admin_ip=verify` dihapus, begitu juga kartu verifikasi IP di
  settings (`admin-ip-verify-card.tsx`), supaya hanya ada satu tempat.
- Teks email diubah dari "alamat IP baru" menjadi "verifikasi akses Panel Admin". IP tetap
  dicantumkan sebagai info.

## Keputusan builder (bukan dari user)

- Loopback (localhost) tetap dilewati hanya kalau `NODE_ENV !== 'production'`, supaya dev lokal
  tidak perlu email.
- Format `value` row: `verified:<lastBumpEpochMs>:<countryCode atau ->`, untuk throttle 5 menit
  dan cek negara.
- Komponen pop-up memakai ulang logika form dari kartu settings yang lama.

## Risiko yang diterima

Tanpa pemicu IP dan tanpa batas mutlak, cookie sesi yang dicuri dan dipakai minimal sekali
sehari dari negara yang sama dengan saat verifikasi tidak akan pernah
diminta OTP sampai sesinya berakhir (default Better Auth 7 hari sliding). Ini diterima demi
kenyamanan. Cek negara gugur diam-diam kalau header geo tidak ada.

## Di luar scope (temuan sampingan)

`apps/web/src/middleware.ts:151` hanya membaca `cf-ipcountry` / `x-vercel-ip-country` /
`x-country-code`, jadi di Netlify negara kemungkinan default ke `US` dan user Indonesia bisa
dapat mata uang USD. Tidak diubah di pekerjaan ini.

## Verifikasi

- Unit test untuk logika "perlu OTP?" (row tidak ada, row kedaluwarsa, row valid, throttle).
- Test bahwa pemicu IP tidak lagi memunculkan OTP.
- Unit test cek negara: ID ke SG (OTP), SG ke SG (tidak), SG ke ID (OTP), negara tidak
  diketahui (tidak, ada warn), parsing `x-nf-geo` yang rusak (dianggap tidak diketahui).
- UI pop-up mengikuti antislop (core + `antislop-ui` + `antislop-human`) selama pengerjaan.
- Cek manual: buka `/admin`, pop-up muncul, isi kode, panel tampil. Pindah ke dashboard lalu
  kembali, tidak diminta lagi.
