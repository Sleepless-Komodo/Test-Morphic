# Fix Plan — Frontend (FIX_FE.md)

**Platform:** Morphic AI Dashboard & Admin (`apps/web`)  
**Dibuat:** 2026-10-04  
**Standar Item:** Setiap item memiliki status kesiapan dependensi: `[INDEPENDEN]` (dapat langsung dikerjakan) atau `[BLOCKED_BY: ID_BE]` (menunggu endpoint backend).

---

## FASE P0 — KEAMANAN KRITIS & INTEGRITAS DATA

---

### [FIX-FE-P0-01] Hapus Tombol Pengungkapan Key ("Mata") & Salin Key Lama dari UI Dasbor Key
- **Kesiapan:** `[BLOCKED_BY: FIX-BE-P0-01]` (dapat dikerjakan bersamaan)
- **Fase:** P0
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`apps/web/src/app/dashboard/keys/keys-view.tsx:301-320`, `actions.ts:120, 153`)
- **Sumber Temuan:** T-B2-01, AC-KEY-02
- **Lokasi Kode:**
  - `apps/web/src/app/dashboard/keys/keys-view.tsx:301-320`
  - `apps/web/src/lib/actions.ts:120, 153`
- **Masalah:**
  UI secara sengaja menyediakan tombol mata (`toggleReveal`) dan copy (`handleCopyKey`) untuk setiap baris key lama. Hal ini menuntut server menyimpan ciphertext reversibel dan melanggar prinsip "key hanya ditampilkan sekali saat dibuat".
- **Perubahan yang Diminta:**
  1. Di `apps/web/src/lib/actions.ts`:
     - Hapus pemanggilan `decryptApiKey(r.encryptedKey)`.
     - Tipe return `listApiKeys()` tidak lagi memuat `rawKey`.
  2. Di `apps/web/src/app/dashboard/keys/keys-view.tsx`:
     - Hapus tombol "Mata" (`toggleReveal`) dan tombol "Salin" pada tabel daftar API key.
     - Setiap baris tabel HANYA me-render prefix: `k.keyPrefix + '••••••••'`.
     - Key plaintext penuh HANYA ditampilkan di modal dialog saat key baru saja dibuat (`CreateKeyDialog`), dengan peringatan tegas: *"Simpan key ini sekarang. Anda tidak akan dapat melihatnya lagi."*
- **Acceptance Criteria:**
  - Tidak ada tombol mata atau cara apa pun di UI untuk melihat kembali plaintext API key lama.
  - Modal pembuatan key baru menampilkan key penuh satu kali dengan tombol salin.
- **Tes Wajib:**
  - E2E / Component test: pastikan baris tabel API key tidak merender elemen button reveal dan hanya memuat teks masking prefix.
- **Risiko Regresi:** Pengguna terbiasa menyalin key lama dari UI; perlu edukasi microcopy di UI.
- **Status:** Completed

---

### [FIX-FE-P0-02] Perbarui Dialog Hapus Akun dengan Re-Autentikasi & Penjelasan Soft-Delete
- **Kesiapan:** `[BLOCKED_BY: FIX-BE-P0-06]`
- **Fase:** P0
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`apps/web/src/app/dashboard/settings/settings-view.tsx:610-709`)
- **Sumber Temuan:** T-B1-05, AC-PRV-02
- **Lokasi Kode:** `apps/web/src/app/dashboard/settings/settings-view.tsx`
- **Masalah:**
  Konfirmasi hapus akun saat ini hanya mencocokkan string email tanpa meminta kata sandi (re-authentication), dan teks informasi tidak menjelaskan kebijakan retensi data keuangan.
- **Perubahan yang Diminta:**
  1. Tambahkan input kata sandi saat konfirmasi hapus akun (re-autentikasi keamanan sebelum aksi destruktif).
  2. Tambahkan disclaimer legal: *"Akun Anda akan dinonaktifkan dan data profil dihapus. Sesuai ketentuan hukum perpajakan dan keuangan, catatan transaksi dan riwayat penggunaan akan dianonimkan dan disimpan selama 5 tahun."*
- **Acceptance Criteria:**
  - Pengguna harus memasukkan password yang benar untuk mengonfirmasi hapus akun.
  - Teks disclaimer retensi keuangan tampil jelas di modal.
- **Tes Wajib:**
  - Test modal: submit tanpa password atau password salah → ditolak; password benar → akun dinonaktifkan.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

## FASE P1 — STABILITAS, KEAMANAN ADMIN & KEPATUHAN

---

### [FIX-FE-P1-01] Antarmuka Pendaftaran & Pengaktifan MFA/TOTP Pengguna & Enforce Admin
- **Kesiapan:** `[BLOCKED_BY: FIX-BE-P1-01]`
- **Fase:** P1
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (tidak ada UI MFA di settings)
- **Sumber Temuan:** T-B1-01, T-B5-01, AC-ADM-01
- **Lokasi Kode:**
  - `apps/web/src/app/dashboard/settings/settings-view.tsx` (seksi Keamanan)
  - `apps/web/src/app/admin/layout.tsx`
  - `apps/web/src/app/auth/mfa/page.tsx` (halaman baru)
- **Masalah:**
  Pengguna dan admin tidak memiliki antarmuka untuk setup authenticator app (TOTP QR code) dan input 6-digit verification code.
- **Perubahan yang Diminta:**
  1. Buat komponen `TwoFactorSetupModal` di Settings:
     - Generate QR code rahasia TOTP dari Better Auth API.
     - Tampilkan secret manual untuk authenticator app.
     - Input 6 digit token untuk konfirmasi aktivasi.
     - Tampilkan recovery backup codes (sekali pakai).
  2. Di `admin/layout.tsx`: Jika admin belum mengaktifkan MFA, tampilkan blocking banner / dialog wajib setup MFA sebelum tombol-tombol konsol admin dapat diklik.
- **Acceptance Criteria:**
  - Admin dan user dapat memindai QR code dan mengaktifkan 2FA.
  - Admin yang belum aktif 2FA diblokir dari aksi manajemen pengguna/model.
- **Tes Wajib:**
  - Test alur aktivasi 2FA: input kode salah → gagal; input kode benar → 2FA berstatus aktif.
- **Risiko Regresi:** Admin harus memiliki smartphone/authenticator app untuk login.
- **Status:** Pending

---

### [FIX-FE-P1-02] Halaman UI Forgot Password & Reset Password
- **Kesiapan:** `[BLOCKED_BY: FIX-BE-P0-02]`
- **Fase:** P1
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (tidak ada rute `/forgot-password` atau `/reset-password` di `apps/web/src/app`)
- **Sumber Temuan:** T-B1-08, FR-AUTH-03
- **Lokasi Kode:**
  - `apps/web/src/app/(auth)/forgot-password/page.tsx` (file baru)
  - `apps/web/src/app/(auth)/reset-password/page.tsx` (file baru)
- **Masalah:**
  Pengguna yang lupa kata sandi tidak memiliki tautan atau halaman formulir untuk meminta link reset kata sandi di antarmuka web.
- **Perubahan yang Diminta:**
  1. Buat halaman `/forgot-password`: formulir input email → memanggil Better Auth `forgetPassword()` → menampilkan pesan seragam *"Jika email terdaftar, tautan pemulihan telah dikirim."*
  2. Buat halaman `/reset-password?token=...`: formulir kata sandi baru + konfirmasi kata sandi (minimal 8 karakter, validasi zxcvbn).
  3. Tambahkan tautan *"Lupa kata sandi?"* di halaman login `/login/email`.
- **Acceptance Criteria:**
  - Pengguna dapat meminta link reset dan mengubah password mereka menggunakan token dari email.
- **Tes Wajib:**
  - E2E test reset password flow.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

### [FIX-FE-P1-03] Tombol Permohonan Ekspor Data Pribadi (DSAR) di Dasbor Pengaturan
- **Kesiapan:** `[BLOCKED_BY: FIX-BE-P1-06]`
- **Fase:** P1
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`settings-view.tsx` tidak memiliki tombol DSAR)
- **Sumber Temuan:** T-B6-02, AC-PRV-01
- **Lokasi Kode:** `apps/web/src/app/dashboard/settings/settings-view.tsx`
- **Masalah:**
  Tidak ada elemen antarmuka yang memungkinkan pengguna mengajukan hak akses dan ekspor data pribadi (DSAR) sesuai regulasi UU PDP.
- **Perubahan yang Diminta:**
  1. Tambahkan kartu *Privasi & Data Subjek* di `settings-view.tsx`:
     - Tombol *"Minta Salinan Data Saya (DSAR)"*.
     - Teks keterangan: *"Kami akan mengumpulkan seluruh data riwayat akun, penggunaan, dan transaksi Anda dalam format JSON terenkripsi."*
     - Status permintaan: Menampilkan badge `Menunggu` / `Siap Diunduh` beserta link download.
- **Acceptance Criteria:**
  - Mengklik tombol memicu `POST /v1/account/dsar` dan menampilkan feedback berhasil.
- **Tes Wajib:**
  - Test klik tombol DSAR → status badge berubah menjadi `Menunggu`.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

## FASE P2 — KEPATUHAN REGULASI & FITUR PENGGUNA

---

### [FIX-FE-P2-01] Komponen Cookie Consent Banner & Pengaturan Preferensi Cookie
- **Kesiapan:** `[INDEPENDEN]` (dapat langsung dikerjakan)
- **Fase:** P2
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`layout.tsx` tidak memuat consent banner)
- **Sumber Temuan:** T-B6-05, FR-PRV-03
- **Lokasi Kode:**
  - `apps/web/src/components/cookie-banner.tsx` (komponen baru)
  - `apps/web/src/app/layout.tsx`
- **Masalah:**
  Tidak ada Cookie Consent Banner di aplikasi publik. Seluruh cookie dimuat tanpa persetujuan awal pengguna, melanggar standar privasi modern (ePrivacy / UU PDP).
- **Perubahan yang Diminta:**
  1. Buat komponen `CookieBanner` floating di bawah halaman:
     - Tombol *"Terima Semua"*, *"Hanya Esensial"*, dan *"Pengaturan"*.
     - Simpan pilihan di `localStorage` (`cookie_consent: 'all' | 'essential'`).
  2. Jangan jalankan skrip analitik pihak ketiga sebelum izin `'all'` diberikan.
- **Acceptance Criteria:**
  - Banner muncul untuk pengunjung baru dan menghilang setelah tombol diklik.
- **Tes Wajib:**
  - Test banner: klik 'Hanya Esensial' → verifikasi skrip tracking tidak di-load.
- **Risiko Regresi:** Sangat rendah.
- **Status:** Pending

---

### [FIX-FE-P2-02] Tombol Ekspor CSV Riwayat Penggunaan & Transaksi Dasbor
- **Kesiapan:** `[INDEPENDEN]` (client-side export dari tabel data)
- **Fase:** P2
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`usage-view.tsx` & `transactions-view.tsx` tanpa tombol ekspor)
- **Sumber Temuan:** T-B5-02, AC-DASH-03
- **Lokasi Kode:**
  - `apps/web/src/app/dashboard/usage/usage-view.tsx`
  - `apps/web/src/app/dashboard/transactions/transactions-view.tsx`
- **Masalah:**
  Pengguna bisnis tidak dapat mengekspor riwayat pemakaian token atau mutasi transaksi top-up ke format CSV untuk rekonsiliasi pembukuan akuntansi.
- **Perubahan yang Diminta:**
  1. Tambahkan tombol *"Ekspor CSV"* di pojok kanan atas tabel penggunaan (`usage-view.tsx`) dan tabel transaksi (`transactions-view.tsx`).
  2. Implementasikan helper `exportToCsv(filename, rows)`:
     - Escape karakter koma dan kutip.
     - Generate file Blob `text/csv` dan picu download di browser.
- **Acceptance Criteria:**
  - Mengklik tombol langsung mengunduh file `.csv` dengan header kolom yang rapi dan data lengkap.
- **Tes Wajib:**
  - Test download CSV: pastikan format baris cocok dengan data tabel yang sedang aktif.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

### [FIX-FE-P2-03] Tombol Unduh Kuitansi / Invoice Digital di Tabel Transaksi
- **Kesiapan:** `[BLOCKED_BY: FIX-BE-P2-01]`
- **Fase:** P2
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`transactions-view.tsx` tidak memiliki aksi unduh)
- **Sumber Temuan:** T-B4-02, AC-BILL-07
- **Lokasi Kode:** `apps/web/src/app/dashboard/transactions/transactions-view.tsx`
- **Masalah:**
  Pengguna tidak memiliki tombol untuk mengunduh bukti bayar (invoice PDF) pada transaksi yang berstatus `success`.
- **Perubahan yang Diminta:**
  Di kolom aksi pada setiap baris transaksi top-up yang berhasil:
  - Tampilkan tombol ikon dokumen / *"Unduh Kuitansi"*.
  - Link mengarah ke `/api/backend/v1/payments/${tx.id}/receipt`.
- **Acceptance Criteria:**
  - Klik tombol membuka tab baru atau mengunduh berkas PDF kuitansi resmi.
- **Tes Wajib:**
  - Test klik aksi kuitansi pada baris berstatus success.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

### [FIX-FE-P2-04] Filter Pencarian & Tombol Ekspor pada Audit Log Konsol Admin
- **Kesiapan:** `[INDEPENDEN]`
- **Fase:** P2
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/web/src/app/admin/audit/page.tsx:1-87` statis 100 entri)
- **Sumber Temuan:** T-B5-06, FR-ADM-07
- **Lokasi Kode:** `apps/web/src/app/admin/audit/page.tsx`
- **Masalah:**
  Halaman penampil audit log admin hanya menampilkan 100 baris query statis tanpa fitur pencarian, filter tanggal/aktor, atau tombol ekspor berkas.
- **Perubahan yang Diminta:**
  1. Tambahkan bilah filter: input teks pencarian (admin email / entitas), dropdown aksi (`user.suspend`, `model.create`, dll.), dan filter rentang tanggal.
  2. Tambahkan tombol *"Ekspor Audit Log (CSV)"*.
- **Acceptance Criteria:**
  - Admin dapat memfilter entri log berdasarkan kriteria pencarian dan mengekspor hasilnya.
- **Tes Wajib:**
  - Test filter: pilih aksi 'user.suspend' → tabel hanya menampilkan aksi tersebut.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

## FASE P3 — HARDENING & POLISHING

---

### [FIX-FE-P3-01] Visualisasi Grafik Tren Biaya & Burn-Rate Proyeksi Saldo di Dasbor
- **Kesiapan:** `[INDEPENDEN]`
- **Fase:** P3
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`dashboard/page.tsx` hanya angka statis total saldo)
- **Sumber Temuan:** T-B5-05, FR-DASH-04
- **Lokasi Kode:** `apps/web/src/app/dashboard/page.tsx`
- **Masalah:**
  Dasbor utama hanya menampilkan kartu angka total saldo dan request, tanpa grafik tren konsumsi harian dan tanpa proyeksi estimasi sisa hari saldo (burn rate).
- **Perubahan yang Diminta:**
  1. Tambahkan komponen chart (menggunakan Recharts atau SVG ringan bawaan) yang memvisualisasikan konsumsi token/kredit selama 14 hari terakhir.
  2. Tambahkan widget kalkulasi: *"Berdasarkan rata-rata konsumsi 7 hari terakhir, saldo Anda diperkirakan mencukupi untuk ~X hari lagi."*
- **Acceptance Criteria:**
  - Tampilan grafik tren biaya harian muncul dengan rapi dan responsif di mobile.
- **Tes Wajib:**
  - Test visualisasi chart dengan data mock penggunaan.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

### [FIX-FE-P3-02] Penegakan Header Content-Security-Policy (CSP Enforced)
- **Kesiapan:** `[INDEPENDEN]`
- **Fase:** P3
- **Severity:** 🔵 Rendah
- **Keyakinan:** Confirmed (`apps/web/next.config.mjs:39` disetel `Report-Only`)
- **Sumber Temuan:** T-B5-10, FE-02
- **Lokasi Kode:** `apps/web/next.config.mjs:39`
- **Masalah:**
  Header CSP masih dalam mode `Content-Security-Policy-Report-Only`, sehingga skrip jahat injeksi (XSS) tidak diblokir secara aktif oleh browser.
- **Perubahan yang Diminta:**
  1. Ganti nama header menjadi `Content-Security-Policy` (tanpa `-Report-Only`).
  2. Pastikan direktif script-src mengizinkan nonce Next.js dan domain API Duitku/PayPal.
- **Acceptance Criteria:**
  - Injeksi script inline asing otomatis diblokir oleh peramban modern.
- **Tes Wajib:**
  - Cek security headers via curl / devtools network tab.
- **Risiko Regresi:** Waspadai script framer-motion atau analitik yang memerlukan izin domain khusus.
- **Status:** Pending

---

### [FIX-FE-P3-03] Antarmuka Rotasi API Key di Dasbor Pengguna
- **Kesiapan:** `[BLOCKED_BY: FIX-BE-P3-03]`
- **Fase:** P3
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (tidak ada tombol aksi rotasi di tabel key)
- **Sumber Temuan:** T-B2-03, AC-KEY-05
- **Lokasi Kode:** `apps/web/src/app/dashboard/keys/keys-view.tsx`
- **Masalah:**
  Pengguna tidak memiliki antarmuka untuk merotasi API key yang ada dengan masa tenggang.
- **Perubahan yang Diminta:**
  1. Tambahkan menu aksi *"Rotasi Kunci"* pada dropdown baris API key.
  2. Tampilkan dialog konfirmasi: pilihan masa tenggang (1 jam / 24 jam / 7 hari).
  3. Setelah dikonfirmasi, tampilkan modal key baru (ditampilkan sekali) dan badge `Rotating (kadaluwarsa dalam X jam)` pada key lama.
- **Acceptance Criteria:**
  - Pengguna dapat merotasi key langsung dari dasbor web.
- **Tes Wajib:**
  - Test alur rotasi key di UI.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

*Dokumen FIX_FE.md selesai disusun. 10 item antarmuka pengguna dipetakan dengan status dependensi.*
