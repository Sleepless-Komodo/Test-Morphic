# Fix Plan — Backend (FIX_BE.md)

**Platform:** Morphic AI API Gateway (`apps/api`, `packages/db`, `packages/shared`)  
**Dibuat:** 2026-10-04  
**Standar Item:** Format lengkap per ID, Fase, Severity, Keyakinan, Lokasi kode, Masalah, Perubahan diminta, Acceptance Criteria, Tes wajib, Ketergantungan, Risiko regresi, Status.

---

## FASE P0 — KEAMANAN KRITIS & INTEGRITAS DATA

---

### [FIX-BE-P0-01] Hapus Kolom `encrypted_key`, Hentikan Enkripsi API Key, dan Jadikan Key Hash-Only
- **Fase:** P0 (Harus sebelum traffic produksi baru)
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (Terverifikasi di `schema.ts:91`, `routes/keys.ts:111`, `backend/[...path]/route.ts:172`)
- **Sumber Temuan:** T-B2-01, T-B2-02, T-B1-02
- **Lokasi Kode:**
  - `packages/db/src/schema.ts:91` (kolom `encryptedKey`)
  - `apps/api/src/routes/keys.ts:50-55, 111`
  - `apps/web/src/app/api/backend/[...path]/route.ts:172-194`
- **Masalah:**
  Ciphertext AES-256-GCM disimpan di DB untuk memungkinkan pengungkapan (reveal) key kapan saja melalui UI/API. Jika database bocor, seluruh API key pengguna dapat didekripsi dan disalahgunakan. Melanggar prinsip POL-DATA-03, NIST SP 800-63B, dan FR-KEY-02.
- **Perubahan yang Diminta:**
  1. Hapus kolom `encryptedKey` dari `apiKeys` di `packages/db/src/schema.ts`.
  2. Buat file migrasi SQL: `ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "encrypted_key";`.
  3. Di `apps/api/src/routes/keys.ts`:
     - Baris 50–55: Saat `POST /v1/keys`, simpan hanya `keyHash` dan `keyPrefix`. Key plaintext dikembalikan HANYA SEKALI di respons POST tersebut.
     - Baris 111: Pada `GET /v1/keys`, jangan panggil `decryptApiKey()`. Properti `key` dihapus dari respons list (hanya kembalikan `keyPrefix`, `name`, `createdAt`, dll.).
  4. Hapus seluruh blok intercept proxy backfill di `apps/web/src/app/api/backend/[...path]/route.ts:172-194`.
- **Acceptance Criteria:**
  - `GET /v1/keys` tidak mengembalikan field `key` (hanya `key_prefix`).
  - Tidak ada data terenkripsi key yang tersimpan di PostgreSQL.
  - Key dibuat, di-hash dengan SHA-256, dan hash cocok saat autentikasi gateway.
- **Tes Wajib:**
  - Unit test `keys.test.ts`: verifikasi respons `GET /v1/keys` tidak memuat substring `mp-` pada properti apa pun selain `keyPrefix`.
  - Migration test: jalankan `pnpm db:migrate` dan pastikan kolom `encrypted_key` lenyap dari PostgreSQL information_schema.
- **Ketergantungan:** Perubahan FE FIX-FE-P0-01 (hapus tombol reveal di dashboard).
- **Risiko Regresi:** Pengguna tidak lagi dapat melihat kembali API key lama mereka; harus membuat key baru jika lupa (sesuai standar industri OpenAI/Stripe).
- **Status:** Completed

---

### [FIX-BE-P0-02] Integrasi Email Provider Transaksional (Resend / AWS SES)
- **Fase:** P0
- **Severity:** 🔴 Kritis (AC Level)
- **Keyakinan:** Confirmed (0 provider email di seluruh repo)
- **Sumber Temuan:** T-B6-01, AC-NOT-01
- **Lokasi Kode:**
  - `packages/shared/src/email.ts` (file baru)
  - `apps/web/src/lib/auth.ts:80-84`
  - `apps/api/src/routes/payments.ts` (saat pembayaran sukses)
- **Masalah:**
  Tidak ada satupun provider email transaksional di platform. Pengguna tidak menerima email verifikasi, link reset password, kuitansi top-up, maupun peringatan saldo. Akun dapat aktif tanpa verifikasi email riil.
- **Perubahan yang Diminta:**
  1. Tambahkan dependensi `resend` (atau `@aws-sdk/client-ses`) pada `packages/shared`.
  2. Buat `packages/shared/src/email.ts` dengan interface seragam:
     `sendEmail({ to, subject, html, text })`.
  3. Konfigurasikan plugin email di `apps/web/src/lib/auth.ts`:
     - `sendVerificationEmail`: kirim link verifikasi Better Auth via Resend.
     - `sendResetPassword`: kirim link reset password dengan token sekali pakai TTL 30 menit.
  4. Panggil `sendEmail` saat:
     - Top-up berhasil (kuitansi transaksi di `processPaymentSuccess`).
     - Saldo mencapai ambang batas rendah (< 10%).
- **Acceptance Criteria:**
  - Pendaftaran akun baru mengirimkan email verifikasi dengan token valid.
  - Link reset password terkirim saat diminta dan kedaluwarsa setelah 30 menit.
- **Tes Wajib:**
  - Mock email test: pastikan `sendEmail()` dipanggil dengan payload yang benar pada event pendaftaran dan reset password.
- **Ketergantungan:** Keputusan pemilik OWN-02 (pemilihan vendor Resend vs SES).
- **Risiko Regresi:** Memerlukan konfigurasi `RESEND_API_KEY` atau kredensial AWS di environment.
- **Status:** Pending

---

### [FIX-BE-P0-03] Implementasi Inbound Server-to-Server Webhook untuk PayPal
- **Fase:** P0
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`routes/webhooks.ts:26` hanya ada `/mock` dan `/duitku`)
- **Sumber Temuan:** T-B4-01, AC-BILL-03
- **Lokasi Kode:**
  - `apps/api/src/routes/webhooks.ts`
  - `apps/api/src/domain/paypal.ts` (atau helper baru)
- **Masalah:**
  Fulfillment pembayaran PayPal bergantung sepenuhnya pada browser klien yang memanggil endpoint `/paypal/capture`. Jika koneksi putus atau tab ditutup sebelum redirect selesai, uang pengguna terpotong di PayPal namun kredit Morphic tidak masuk.
- **Perubahan yang Diminta:**
  1. Daftarkan rute `webhooks.post('/paypal', ...)` di `apps/api/src/routes/webhooks.ts`.
  2. Implementasikan verifikasi signature webhook PayPal menggunakan PayPal SDK atau calling endpoint PayPal API `/v1/notifications/verify-webhook-signature`:
     - Headers: `PAYPAL-AUTH-ALGO`, `PAYPAL-CERT-URL`, `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-SIG`, `PAYPAL-TRANSMISSION-TIME`.
  3. Tangani event:
     - `CHECKOUT.ORDER.APPROVED` / `PAYMENT.CAPTURE.COMPLETED`: cari order ID di DB, panggil `processPaymentSuccess()` secara idempoten.
- **Acceptance Criteria:**
  - Simulasi pengiriman event `PAYMENT.CAPTURE.COMPLETED` dari PayPal sandbox berhasil menambah saldo tanpa ada intervensi browser klien.
  - Webhook dengan signature tidak valid ditolak HTTP 401.
  - Pemrosesan event kedua kali tidak menyebabkan saldo terisi ganda (idempoten).
- **Tes Wajib:**
  - Integration test dengan mock PayPal webhook payload + valid signature vs invalid signature.
- **Ketergantungan:** Kredensial `PAYPAL_WEBHOOK_ID` di environment.
- **Risiko Regresi:** Rendah. Route baru yang tidak mengganggu route yang sudah ada.
- **Status:** Completed

---

### [FIX-BE-P0-04] Guard Endpoint `/webhooks/mock` Khusus Non-Production
- **Fase:** P0
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`apps/api/src/routes/webhooks.ts:25-78`)
- **Sumber Temuan:** D-SK-01
- **Lokasi Kode:** `apps/api/src/routes/webhooks.ts:25`
- **Masalah:**
  Endpoint `/webhooks/mock` yang dapat mengisi saldo kredit riil aktif di lingkungan produksi tanpa pengecekan `NODE_ENV`.
- **Perubahan yang Diminta:**
  Bungkus route `/mock` dengan guard:
  ```typescript
  if (process.env.NODE_ENV !== 'production') {
    webhooks.post('/mock', async (c) => { ... });
  }
  ```
  Atau kembalikan 404 jika di production:
  ```typescript
  if (process.env.NODE_ENV === 'production') {
    return c.json({ error: 'not found' }, 404);
  }
  ```
- **Acceptance Criteria:**
  - Saat `NODE_ENV=production`, request ke `POST /webhooks/mock` mengembalikan 404.
- **Tes Wajib:**
  - Unit test dengan `process.env.NODE_ENV = 'production'` → assert status 404.
- **Ketergantungan:** Tidak ada.
- **Risiko Regresi:** Nol di produksi. Pengujian lokal tetap berjalan jika `NODE_ENV=test` atau `development`.
- **Status:** Completed

---

### [FIX-BE-P0-05] Teruskan Client Abort Signal ke Fetch Upstream
- **Fase:** P0
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`apps/api/src/domain/router.ts:180-187`)
- **Sumber Temuan:** T-B3-01, AC-GW-10
- **Lokasi Kode:** `apps/api/src/domain/router.ts:180-187`
- **Masalah:**
  `router.ts` mengabaikan `req.signal` yang dikirim dari klien Hono dan hanya menggunakan `timeoutSignal`. Ketika klien membatalkan request atau jaringan terputus, pemrosesan di upstream provider tetap berjalan penuh hingga 55 detik, membakar biaya token platform secara sia-sia.
- **Perubahan yang Diminta:**
  Gunakan `AbortSignal.any()` untuk menggabungkan `req.signal` dengan timeout:
  ```typescript
  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const combinedSignal = req.signal
    ? AbortSignal.any([req.signal, timeoutSignal])
    : timeoutSignal;

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: combinedSignal,
  });
  ```
- **Acceptance Criteria:**
  - Ketika klien menutup koneksi sebelum respons selesai, koneksi ke provider hulu langsung dibatalkan (terpicu `AbortError`).
- **Tes Wajib:**
  - Integration test: buat stream request, batalkan AbortController klien setelah 50ms, pastikan adapter melempar `AbortError` dan fetch hulu berhenti.
- **Ketergantungan:** Node.js v20+ atau Bun (sudah mendukung `AbortSignal.any`).
- **Risiko Regresi:** Sangat rendah.
- **Status:** Pending

---

### [FIX-BE-P0-06] Ubah Hapus Akun Menjadi Soft-Delete & Anonimisasi PII (Cegah CASCADE Ledger)
- **Fase:** P0
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`packages/db/src/schema.ts:195, 326`, `actions.ts:563`)
- **Sumber Temuan:** T-B1-05, AC-PRV-02
- **Lokasi Kode:**
  - `packages/db/src/schema.ts:24, 195, 326`
  - `apps/web/src/lib/actions.ts:550-572` (atau API handler akun)
- **Masalah:**
  `db.delete(users)` mengeksekusi cascading delete fisik di PostgreSQL yang melenyapkan seluruh baris di `credit_ledger`, `payments`, dan `usage_records`. Ini melanggar integritas retensi hukum akuntansi (minimal 5 tahun per DM-RULE-05) dan UU PDP.
- **Perubahan yang Diminta:**
  1. Tambahkan kolom `deletedAt: timestamp('deleted_at')` pada tabel `users` di `packages/db/src/schema.ts`.
  2. Ubah foreign key constraint `credit_ledger.user_id` dan `payments.user_id` dari `{ onDelete: 'cascade' }` menjadi `{ onDelete: 'restrict' }` atau `{ onDelete: 'set null' }`.
  3. Saat aksi hapus akun dipanggil:
     - Anonimkan data PII: `email = 'deleted_' + id + '@redacted.local'`, `name = 'Deleted User'`.
     - Cabut seluruh sesi aktif dan API key pengguna.
     - Set `deletedAt = new Date()`.
     - JANGAN panggil `db.delete(users)`.
- **Acceptance Criteria:**
  - Setelah hapus akun, baris `credit_ledger` dan `payments` tetap utuh di database.
  - Email dan nama di tabel `users` telah disamarkan.
  - Pengguna tidak dapat login kembali dengan kredensial lama.
- **Tes Wajib:**
  - DB test: buat user, isi saldo, hapus akun → assert baris ledger tetap ada dengan status akun bertanda `deleted_at`.
- **Ketergantungan:** Perubahan FE FIX-FE-P0-02 (dialog konfirmasi hapus akun).
- **Risiko Regresi:** Perlu memastikan query aktif di dashboard mengecualikan user yang `deleted_at IS NOT NULL`.
- **Status:** Pending

---

## FASE P1 — STABILITAS, KEAMANAN ADMIN & KEPATUHAN

---

### [FIX-BE-P1-01] Aktifkan Plugin MFA/TOTP Better Auth & Enforce MFA untuk Admin
- **Fase:** P1
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`apps/web/src/lib/auth.ts` tidak mengaktifkan `twoFactor`)
- **Sumber Temuan:** T-B1-01, T-B5-01, AC-ADM-01
- **Lokasi Kode:**
  - `apps/web/src/lib/auth.ts:50-70`
  - `apps/web/src/lib/admin.ts` (`requireAdmin()`)
- **Masalah:**
  Better Auth plugin `twoFactor` dinonaktifkan. Pengguna admin hanya login dengan email dan password biasa tanpa lapisan pertahanan kedua, rentan terhadap credential stuffing / ATO.
- **Perubahan yang Diminta:**
  1. Tambahkan plugin `twoFactor()` pada konfigurasi Better Auth di `apps/web/src/lib/auth.ts`.
  2. Di fungsi otorisasi `requireAdmin()`: periksa apakah admin memiliki `twoFactorEnabled === true`. Jika belum, paksa redirect ke setup TOTP atau tolak akses aksi admin.
- **Acceptance Criteria:**
  - Pengguna dapat mengaktifkan TOTP via authenticator app (Google Auth, Aegis).
  - Akun dengan role `admin` tidak dapat mengakses dashboard `/admin` sebelum TOTP diaktifkan dan diverifikasi pada sesi aktif.
- **Tes Wajib:**
  - Test login flow: admin tanpa MFA ditolak saat mengakses rute layout admin.
- **Ketergantungan:** FE setup TOTP UI.
- **Risiko Regresi:** Admin yang sudah ada harus mendaftarkan MFA pada login berikutnya.
- **Status:** Pending

---

### [FIX-BE-P1-02] Pasang Middleware `bodyLimit` pada Router Gateway
- **Fase:** P1
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/api/src/routes/v1.ts:102` memanggil `c.req.json()` tanpa batas)
- **Sumber Temuan:** T-B3-03, PROXY-04
- **Lokasi Kode:** `apps/api/src/routes/v1.ts:16-18`
- **Masalah:**
  Tidak ada batas ukuran payload HTTP request body. Penyerang dapat mengirim payload JSON ratusan MB untuk memicu crash memori server (DoS / memory exhaustion, CWE-400).
- **Perubahan yang Diminta:**
  Gunakan middleware bawaan Hono `bodyLimit`:
  ```typescript
  import { bodyLimit } from 'hono/body-limit';

  v1.use('/*', bodyLimit({
    maxSize: 10 * 1024 * 1024, // 10 MB per PRD §14.1
    onError: (c) => c.json({ error: { message: 'payload too large', type: 'invalid_request_error', code: 'payload_too_large' } }, 413)
  }));
  ```
- **Acceptance Criteria:**
  - Request dengan body > 10 MB ditolak HTTP 413 sebelum JSON di-parse.
- **Tes Wajib:**
  - Test dengan buffer 11 MB → assert 413.
- **Ketergantungan:** Tidak ada.
- **Risiko Regresi:** Sangat rendah.
- **Status:** Pending

---

### [FIX-BE-P1-03] Implementasi Dynamic Failover ke Provider Cadangan pada Runtime
- **Fase:** P1
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (`apps/api/src/routes/v1.ts:278-321`)
- **Sumber Temuan:** T-B3-02, AC-GW-05
- **Lokasi Kode:** `apps/api/src/routes/v1.ts:278-330`, `apps/api/src/domain/router.ts`
- **Masalah:**
  Jika panggilan ke provider primer menghasilkan network timeout atau 502/503/504, gateway langsung gagal dan mengembalikan error ke klien tanpa mencoba `fallbackProviderId` yang sudah terdaftar di database model.
- **Perubahan yang Diminta:**
  1. Di `v1.ts`: jika panggilan `callProvider` melempar network error atau mengembalikan status 5xx, catat kegagalan ke circuit breaker provider primer.
  2. Jika model memiliki `fallbackProviderId` dan status circuit breaker fallback provider tidak `open`: lakukan panggilan ulang ke provider fallback secara transparan (tanpa menagih ganda kredit reservasi).
- **Acceptance Criteria:**
  - Ketika provider primer mengembalikan 502, request otomatis dialihkan ke provider fallback dan mengembalikan 200 ke klien.
- **Tes Wajib:**
  - Mock provider test: simulasi upstream primer melempar 502 → verifikasi upstream fallback dipanggil dan respons berhasil.
- **Ketergantungan:** FIX-BE-P1-08 (state circuit breaker di Redis).
- **Risiko Regresi:** Penambahan latensi pada skenario kegagalan provider primer (harus ada connect timeout ketat ≤ 5 detik).
- **Status:** Pending

---

### [FIX-BE-P1-04] Suntikkan Header Standar (`X-Request-Id`, `X-RateLimit-*`, `Retry-After`) dan Field `request_id` di Error JSON
- **Fase:** P1
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`v1.ts:95`, `middleware/auth.ts:81-100`)
- **Sumber Temuan:** T-B3-06, T-B2-06, API-ERR-SCHEME
- **Lokasi Kode:**
  - `apps/api/src/routes/v1.ts`
  - `apps/api/src/middleware/auth.ts`
- **Masalah:**
  Respons gateway tidak menyertakan `X-Request-Id`, `X-RateLimit-Limit-Requests`, `X-RateLimit-Remaining-Requests`, dan `Retry-After` (saat 429). Objek JSON error tidak memiliki field `request_id`.
- **Perubahan yang Diminta:**
  1. Buat middleware global di awal `v1`:
     ```typescript
     v1.use('*', async (c, next) => {
       const requestId = c.req.header('x-request-id') || crypto.randomUUID();
       c.set('requestId', requestId);
       c.header('X-Request-Id', requestId);
       await next();
     });
     ```
  2. Saat rate limit 429 di `middleware/auth.ts`:
     Suntikkan header `Retry-After: 60`, `X-RateLimit-Limit-Requests: 120`, `X-RateLimit-Remaining-Requests: 0`.
  3. Di seluruh helper pembuat JSON error, sertakan `request_id: c.get('requestId')`.
- **Acceptance Criteria:**
  - 100% respons dari `/v1/*` memiliki header `X-Request-Id`.
  - Respons 429 memiliki header `Retry-After`.
  - Semua body error memuat properti `request_id`.
- **Tes Wajib:**
  - Integration test: periksa header respons pada request 200, 400, dan 429.
- **Ketergantungan:** Tidak ada.
- **Risiko Regresi:** Sangat rendah.
- **Status:** Pending

---

### [FIX-BE-P1-05] Suntikkan `stream_options: { include_usage: true }` ke Upstream Request Streaming
- **Fase:** P1
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/api/src/routes/v1.ts:444` memakai heuristic `chunksReceived * 8`)
- **Sumber Temuan:** T-B3-05, PROXY-13
- **Lokasi Kode:** `apps/api/src/domain/router.ts:160-175`, `apps/api/src/routes/v1.ts:444`
- **Masalah:**
  Jika upstream provider tidak mengirimkan objek `usage` di akhir chunk SSE, Morphic menghitung token completion menggunakan perkiraan acak `chunksReceived * 8`, memicu over/under-billing.
- **Perubahan yang Diminta:**
  1. Pada adapter OpenAI di `router.ts`, jika `stream: true`, otomatis tambahkan `stream_options: { include_usage: true }` ke request body yang dikirim ke upstream.
  2. Jika upstream tetap tidak mengirim objek `usage`, fallback menggunakan tokenizer lokal `@dqbd/tiktoken` (cl100k_base) pada teks terkumpul alih-alih tebakan `chunksReceived * 8`.
- **Acceptance Criteria:**
  - Streaming respons menerima usage chunk dari OpenAI upstream.
  - Perhitungan token completion di `usageRecords` akurat.
- **Tes Wajib:**
  - Streaming mock test: uji token metering dengan usage chunk dan tanpa usage chunk (tiktoken fallback).
- **Ketergantungan:** Tidak ada.
- **Risiko Regresi:** Model pihak ketiga yang sangat tua mungkin menolak field `stream_options` (harus dihapus jika model tidak mendukung).
- **Status:** Pending

---

### [FIX-BE-P1-06] Endpoint DSAR (Data Subject Access Request) & Tabel `dsar_requests`
- **Fase:** P1
- **Severity:** 🟠 Tinggi
- **Keyakinan:** Confirmed (tidak ada rute DSAR dan tabel `dsar_requests` hilang)
- **Sumber Temuan:** T-B6-02, AC-PRV-01
- **Lokasi Kode:**
  - `packages/db/src/schema.ts` (tabel `dsarRequests`)
  - `apps/api/src/routes/account.ts` (endpoint `POST /v1/account/dsar`)
- **Masalah:**
  Tidak ada fasilitas ekspor data subjek (DSAR) untuk mematuhi UU PDP Pasal 34 (respons ekspor maksimal 30 hari).
- **Perubahan yang Diminta:**
  1. Definisikan tabel `dsar_requests` di `packages/db/src/schema.ts`:
     `id, userId, status ('pending'|'processing'|'completed'|'failed'), downloadUrl, expiresAt, createdAt`.
  2. Buat endpoint `POST /v1/account/dsar`: membuat job ekspor data pengguna (profil, riwayat transaksi, ringkasan penggunaan, API key prefix) dalam format JSON terkompresi.
  3. Buat endpoint `GET /v1/account/dsar/status` untuk mengunduh arsip yang sudah siap.
- **Acceptance Criteria:**
  - Pengguna dapat meminta salinan data pribadi dan mengunduh berkas ZIP/JSON profil mereka.
- **Tes Wajib:**
  - Test request DSAR → assert data JSON berisi metadata lengkap tanpa memuat password hash atau secret key provider.
- **Ketergantungan:** FE tombol ekspor DSAR.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

### [FIX-BE-P1-07] Nonaktifkan `autoSignIn: true` Pasca Registrasi Sebelum Verifikasi Email
- **Fase:** P1
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/web/src/lib/auth.ts:24`)
- **Sumber Temuan:** T-B1-03, FR-AUTH-01
- **Lokasi Kode:** `apps/web/src/lib/auth.ts:24`
- **Masalah:**
  Fitur `autoSignIn: true` pada Better Auth langsung membuat sesi aktif seketika pengguna mendaftar, memungkinkan pengguna mengakses dasbor dan membuat API key sebelum alamat email mereka terverifikasi.
- **Perubahan yang Diminta:**
  Ubah konfigurasi di `auth.ts`:
  ```typescript
  emailAndPassword: {
    enabled: true,
    autoSignIn: false, // Wajibkan verifikasi email terlebih dahulu
    requireEmailVerification: true,
  }
  ```
- **Acceptance Criteria:**
  - Pengguna baru yang mendaftar diarahkan ke halaman instruksi "Periksa Email Anda", dan tidak bisa login sebelum mengklik tautan di email.
- **Tes Wajib:**
  - Test register flow: pastikan sesi tidak terbentuk sebelum token verifikasi dikonfirmasi.
- **Ketergantungan:** FIX-BE-P0-02 (email provider harus sudah aktif).
- **Risiko Regresi:** Alur onboarding bertambah 1 langkah (verifikasi email).
- **Status:** Pending (diblokir FIX-BE-P0-02)

---

### [FIX-BE-P1-08] Pindahkan State Circuit Breaker dari PostgreSQL ke Redis
- **Fase:** P1
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/api/src/domain/circuit-breaker.ts:24-37, 107-115`)
- **Sumber Temuan:** T-B3-04, NFR-05
- **Lokasi Kode:** `apps/api/src/domain/circuit-breaker.ts`
- **Masalah:**
  Setiap request yang gagal atau berhasil memicu query `db.update(providers)` ke PostgreSQL. Pada load tinggi, ini menyebabkan database write lock contention dan lonjakan latensi di luar batas SLO gateway (p95 ≤ 50ms).
- **Perubahan yang Diminta:**
  1. Ganti persistensi state circuit breaker (`state`, `failureCount`, `lastFailureTime`) menggunakan Redis key: `cb:provider:{id}` dengan TTL 5 menit.
  2. Operasi update kegagalan menggunakan perintah Redis `HINCRBY` dan `HSET` (eksekusi in-memory < 1ms, tanpa membebani PostgreSQL).
- **Acceptance Criteria:**
  - Kegagalan upstream dicatat ke Redis secara sub-milidetik tanpa ada query SQL `UPDATE providers`.
- **Tes Wajib:**
  - Benchmark test: 100 concurrent failures diproses tanpa connection timeout ke PostgreSQL.
- **Ketergantungan:** Koneksi Redis aktif.
- **Risiko Regresi:** State circuit breaker reset saat Redis restart (dapat diterima karena bersifat transien).
- **Status:** Pending

---

## FASE P2 — KEPATUHAN REGULASI & FITUR PENGGUNA

---

### [FIX-BE-P2-01] Pembuatan Invoice / Kuitansi Digital Resmi (PDF)
- **Fase:** P2
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (tidak ada endpoint download invoice)
- **Sumber Temuan:** T-B4-02, AC-BILL-07
- **Lokasi Kode:** `apps/api/src/routes/payments.ts`
- **Masalah:**
  Pengguna tidak dapat mengunduh dokumen kuitansi/invoice resmi untuk reimburse kantor, bertentangan dengan janji di halaman FAQ publik.
- **Perubahan yang Diminta:**
  1. Tambahkan endpoint `GET /v1/payments/:id/receipt`:
     - Ambil transaksi pembayaran dari tabel `payments` (pastikan `status === 'success'`).
     - Generate dokumen PDF sederhana memuat: Nomor Kuitansi, Tanggal, Pengguna, Paket Kredit, Nominal Pembayaran, Gateway Fee, Status Lunas, Cap Digital Morphic.
     - Kembalikan `Content-Type: application/pdf` dengan header `Content-Disposition: attachment; filename="receipt-...pdf"`.
- **Acceptance Criteria:**
  - Pengguna dapat mengunduh berkas PDF yang valid dari riwayat pembayaran mereka.
- **Tes Wajib:**
  - Test download receipt: assert respons 200 dan header PDF valid.
- **Ketergantungan:** FE tombol download kuitansi.
- **Risiko Regresi:** Perlu library PDF generator ringan (misal `@pdf-lib/pdf-lib` atau build-in stream).
- **Status:** Pending

---

### [FIX-BE-P2-02] Trigger Notifikasi Saldo Rendah (< 10% Ambang Batas)
- **Fase:** P2
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (tidak ada trigger saldo rendah di `billing.ts`)
- **Sumber Temuan:** T-B4-03, FR-NOT-01
- **Lokasi Kode:** `packages/db/src/billing.ts:250-280`
- **Masalah:**
  Tidak ada sistem peringatan dini ketika saldo kredit hampir habis, sehingga request pengguna tiba-tiba gagal dengan error 402 tanpa pemberitahuan sebelumnya.
- **Perubahan yang Diminta:**
  Di akhir fungsi `settleUsage`:
  1. Periksa sisa saldo pengguna terhadap ambang batas (misal sisa < 100.000 kredit atau < $1).
  2. Gunakan Redis key dengan TTL 24 jam (`notif:low_balance:{userId}`) sebagai debounce agar tidak mengirim email berulang kali pada setiap request.
  3. Kirim email peringatan saldo rendah via `sendEmail()`.
- **Acceptance Criteria:**
  - Pengguna menerima maksimal 1 email peringatan per 24 jam saat saldo menipis di bawah ambang batas.
- **Tes Wajib:**
  - Test settlement: pastikan fungsi notifikasi dipanggil tepat satu kali saat saldo melewati batas bawah.
- **Ketergantungan:** FIX-BE-P0-02 (email provider).
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

### [FIX-BE-P2-03] Audit Log Terstruktur untuk Siklus Hidup API Key (Create, Revoke, Rotate)
- **Fase:** P2
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/api/src/routes/keys.ts` tidak mencatat audit log)
- **Sumber Temuan:** T-B2-04, AC-KEY-08
- **Lokasi Kode:** `apps/api/src/routes/keys.ts:28-63, 130-145`
- **Masalah:**
  Pembuatan dan pencabutan API key pengguna tidak meninggalkan jejak forensik di audit log (aktor, IP address, waktu), menyulitkan investigasi jika akun dibajak.
- **Perubahan yang Diminta:**
  1. Buat tabel `security_audit_log` (atau gunakan tabel audit terpadu) untuk mencatat aktivitas pengguna.
  2. Pada handler `keys.post('/')` dan `keys.delete('/:id')`:
     Catat entri memuat: `userId`, `action: 'key.created' | 'key.revoked'`, `targetId`, `keyPrefix`, `ipAddress: extractRealIp(c)`, `userAgent`, `createdAt`.
- **Acceptance Criteria:**
  - Setiap kali key dibuat atau dihapus, satu baris log tersimpan di database audit.
- **Tes Wajib:**
  - Test create & delete key → verifikasi baris audit log terbentuk.
- **Ketergantungan:** Tidak ada.
- **Risiko Regresi:** Rendah.
- **Status:** Pending

---

### [FIX-BE-P2-04] Ekstraksi IP yang Aman dari Spoofing & IP Rate Limiting di Gateway Inferensi
- **Fase:** P2
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/api/src/middleware/auth.ts:81-86`)
- **Sumber Temuan:** T-B6-03, AC-ABU-01
- **Lokasi Kode:** `apps/api/src/lib/ip.ts` (helper baru), `apps/api/src/middleware/auth.ts`
- **Masalah:**
  Ekstraksi IP hanya membaca header `x-forwarded-for` tanpa validasi proxy terpercaya, rentan spoofing. Gateway hanya membatasi RPM per key, tidak memiliki IP-level rate limit untuk mencegah serangan DoS dari botnet terdistribusi.
- **Perubahan yang Diminta:**
  1. Buat helper `getTrustedClientIp(req)`: ambil IP dari header Cloudflare (`CF-Connecting-IP`) jika ada, atau elemen terakhir `X-Forwarded-For` yang divalidasi dari reverse proxy tepercaya.
  2. Tambahkan middleware IP rate limit di gateway `/v1/*`: maksimal 300 request per menit per alamat IP publik untuk mencegah flooding.
- **Acceptance Criteria:**
  - Header `X-Forwarded-For` palsu dari klien tidak memengaruhi pembacaan IP riil.
  - Alamat IP yang melebihi 300 RPM diblokir dengan 429 dan header `Retry-After`.
- **Tes Wajib:**
  - Test spoof header: pastikan IP yang dipakai adalah header tepercaya.
- **Ketergantungan:** Tidak ada.
- **Risiko Regresi:** Perlu memastikan IP proxy internal (misal Next.js server proxy) tidak terblokir (gunakan CIDR allowlist).
- **Status:** Pending

---

## FASE P3 — HARDENING, OPTIMISASI & TECHNICAL DEBT

---

### [FIX-BE-P3-01] Pelacakan Biaya Hulu Riil & Deteksi Alarm Margin Negatif
- **Fase:** P3
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (tidak ada kolom modal hulu di tabel models/usage)
- **Sumber Temuan:** T-B5-04, T-B4-05, FR-ADM-06
- **Lokasi Kode:**
  - `packages/db/src/schema.ts` (tabel `models`)
  - `packages/db/src/billing.ts`
- **Masalah:**
  Platform hanya menghitung harga jual kredit ke pengguna, tanpa mencatat biaya modal yang ditagih oleh penyedia hulu (OpenAI/Anthropic). Manajemen tidak dapat mendeteksi model yang merugi (margin negatif).
- **Perubahan yang Diminta:**
  1. Tambahkan kolom `costPer1MInputTokens` dan `costPer1MOutputTokens` pada tabel `models` di `packages/db/src/schema.ts`.
  2. Saat `settleUsage()`, hitung `upstreamCostCents` dan simpan ke baris `usage_records`.
  3. Jika `revenueCents < upstreamCostCents`, kirim alert margin negatif ke log admin / Sentry.
- **Acceptance Criteria:**
  - Admin dapat membandingkan modal hulu vs pendapatan kotor per model.
- **Tes Wajib:**
  - Test settlement: verifikasi kolom `upstream_cost` terisi dengan benar.
- **Ketergantungan:** DB migration.
- **Status:** Pending

---

### [FIX-BE-P3-02] Tambahkan UNIQUE Constraint pada `credit_ledger.reference`
- **Fase:** P3
- **Severity:** 🔵 Rendah
- **Keyakinan:** Confirmed (`packages/db/src/schema.ts:184-210`)
- **Sumber Temuan:** T-B4-06, BILL-06
- **Lokasi Kode:** `packages/db/src/schema.ts:187`
- **Masalah:**
  Kolom `reference` pada `credit_ledger` tidak memiliki `unique()` constraint di DDL PostgreSQL, mengandalkan proteksi duplikasi hanya pada level aplikasi.
- **Perubahan yang Diminta:**
  1. Tambahkan `.unique()` pada kolom `reference` di skema Drizzle.
  2. Buat file migrasi: `ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_reference_unique" UNIQUE ("reference");`.
- **Acceptance Criteria:**
  - Upaya insert transaksi ledger dengan nomor referensi yang sama gagal di level database engine (CWE-362 guard).
- **Tes Wajib:**
  - Test DB constraint: insert dua baris dengan `reference: 'ref-123'` → baris kedua melempar error duplicate key.
- **Ketergantungan:** Bersihkan data referensi duplikat lama jika ada sebelum migrasi dijalankan.
- **Status:** Pending

---

### [FIX-BE-P3-03] Implementasi Endpoint Rotasi Key dengan Grace Period
- **Fase:** P3
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`routes/keys.ts` tidak punya handler `/rotate`)
- **Sumber Temuan:** T-B2-03, AC-KEY-05
- **Lokasi Kode:** `apps/api/src/routes/keys.ts`
- **Masalah:**
  Fitur rotasi key belum tersedia. Pengguna yang ingin merotasi kredensial harus membuat key baru dan menghapus key lama secara manual tanpa ada masa transisi (grace period).
- **Perubahan yang Diminta:**
  1. Tambahkan endpoint `POST /v1/keys/:id/rotate`:
     - Buat key baru pengganti (generate token baru).
     - Set `expiresAt` pada key lama sesuai parameter `gracePeriodSeconds` (default: 86400 detik / 24 jam).
     - Kembalikan key baru (plaintext ditampilkan sekali).
- **Acceptance Criteria:**
  - Key lama tetap dapat digunakan untuk request gateway hingga `expiresAt` tercapai.
  - Key baru langsung aktif seketika.
- **Tes Wajib:**
  - Test rotasi: gunakan kedua key secara paralel dalam jendela masa tenggang → keduanya diterima; gunakan key lama pasca expired → ditolak 401.
- **Ketergantungan:** Tidak ada.
- **Status:** Pending

---

### [FIX-BE-P3-04] Perbarui Kurs Konversi USD/IDR agar Tidak Hardcoded
- **Fase:** P3
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/api/src/routes/payments.ts:186` hardcoded Rp 16.000)
- **Sumber Temuan:** D-SK-02
- **Lokasi Kode:** `apps/api/src/routes/payments.ts:186-189`
- **Masalah:**
  Kurs konversi paket USD ke pembayaran QRIS IDR dipatok kaku di angka 1 USD = Rp 16.000. Jika kurs pasar menguat, platform merugi karena selisih valas.
- **Perubahan yang Diminta:**
  1. Buat service caching kurs valas (refresh setiap 6 jam) dari API publik (misal Bank Indonesia atau Open Exchange Rates) atau sediakan tabel konfigurasi sistem yang dapat diubah admin melalui konsol tanpa redeploy.
- **Acceptance Criteria:**
  - Pembelian paket USD via Duitku menggunakan kurs pasar teranyar.
- **Tes Wajib:**
  - Test konversi paket USD dengan mock nilai tukar dinamis.
- **Ketergantungan:** Keputusan pemilik OWN-04.
- **Status:** Pending

---

### [FIX-BE-P3-05] Batasi Kuota Jumlah Key per Pengguna (Max 20 Key)
- **Fase:** P3
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`apps/api/src/routes/keys.ts:28-63` tanpa count check)
- **Sumber Temuan:** T-B2-05, AC-KEY-09
- **Lokasi Kode:** `apps/api/src/routes/keys.ts:30`
- **Masalah:**
  Tidak ada pengecekan batas jumlah key yang dapat dibuat oleh satu pengguna. Pengguna dapat membuat ribuan key via skrip otomatis (resource exhaustion).
- **Perubahan yang Diminta:**
  Di handler `POST /v1/keys`:
  ```typescript
  const existingCount = await countUserKeys(userId);
  if (existingCount >= 20) {
    return c.json({ error: { message: 'maximum number of API keys reached (20)', type: 'invalid_request_error', code: 'key_quota_exceeded' } }, 400);
  }
  ```
- **Acceptance Criteria:**
  - Pembuatan key ke-21 ditolak dengan HTTP 400.
- **Tes Wajib:**
  - Test loop pemanggilan `POST /v1/keys` 21 kali → request ke-21 mengembalikan 400.
- **Ketergantungan:** Tidak ada.
- **Status:** Pending

---

### [FIX-BE-P3-06] Tambahkan Audit Call di Script `make-admin.ts`
- **Fase:** P3
- **Severity:** 🟡 Sedang
- **Keyakinan:** Confirmed (`packages/db/src/make-admin.ts` tanpa audit insert)
- **Sumber Temuan:** D-SK-03
- **Lokasi Kode:** `packages/db/src/make-admin.ts:34`
- **Masalah:**
  Eskalasi hak akses admin out-of-band via CLI tidak mencatat jejak audit ke tabel `admin_audit_log`.
- **Perubahan yang Diminta:**
  Setelah `db.update(users).set({ role: 'admin' })`, sisipkan perintah insert ke `adminAuditLog` dengan aktor `'system_cli'`.
- **Acceptance Criteria:**
  - Riwayat eskalasi admin via CLI tampil di audit log viewer dasbor.
- **Tes Wajib:**
  - Jalankan script di test env → cek tabel `admin_audit_log`.
- **Status:** Pending

---

*Dokumen FIX_BE.md selesai disusun. Mencakup 17 item backend lintas prioritas P0..P3.*
