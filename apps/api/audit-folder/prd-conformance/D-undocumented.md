# LAPORAN TAHAP D: CEK TERBALIK (UNDOCUMENTED FEATURES & CODE ANALYSIS)

**Platform:** Web AI API Gateway (Morphic)  
**Tanggal Audit:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Dokumen Acuan:** `PRD_AI_API_GATEWAY.md` (v1.0), `SECURITY_AUDIT_CHECKLIST.md` (v1.0), codebase `apps/api/`, `apps/web/`, `packages/db/`, `packages/shared/`  
**Status File:** Selesai Dianalisis

---

## 1. Ringkasan Eksekutif Cek Terbalik

Tahap D melakukan audit secara terbalik (*reverse audit*): memindai seluruh basis kode aktual untuk mengidentifikasi **fitur, endpoint API, tabel database, kolom skema, skrip utilitas, angka konstan (*magic constants*), dan logika bisnis** yang **ADA PADA KODE SUMBER** namun **TIDAK TERCANTUM ATAU TIDAK SESUAI DENGAN SPESIFIKASI PRD**.

Temuan cek terbalik ini diklasifikasikan ke dalam 4 kategori utama:
1. **Undocumented API Endpoints & Routes:** Endpoint aktif di router Hono/Next.js yang tidak ada di daftar antarmuka PRD §14.
2. **Undocumented Database Schema & Entities:** Tabel, kolom, dan relasi di Drizzle ORM yang melampaui atau menyimpang dari rancangan skema PRD §14.2.
3. **Hidden Behaviors & Magic Constants:** Logika tersembunyi, rasio hardcoded, dan asumsi lingkungan yang berjalan tanpa dokumentasi spesifikasi.
4. **Architectural Deviation & Shadow Features:** Fitur bayangan (*shadow features*) seperti sistem Entitlement model pass, public bash installer, mock webhooks, dan skrip eskalasi admin.

---

## 2. Matriks Rute & Endpoint API Tidak Terdokumentasi (Undocumented Routes)

| No | File Kode | Rute / Endpoint | Metode HTTP | Deskripsi Perilaku di Kode | Status Dokumentasi PRD | Tingkat Risiko / Dampak |
|---|---|---|---|---|---|---|
| **D-RT-01** | `apps/api/src/routes/webhooks.ts:25-78` | `/webhooks/mock` | `POST` | Webhook pembayaran QRIS tiruan (*mock*) untuk simulasi pembayaran instan via HMAC-SHA256 (`MOCK_PAYMENT_WEBHOOK_SECRET`). Aktif langsung di router utama `app.ts`. | **TIDAK ADA DI PRD** (PRD §14 hanya menyebut Duitku/PayPal). | 🟠 **Tinggi:** Bila rahasia mock diset atau bocor di lingkungan produksi, pihak luar dapat mengisi saldo kredit secara gratis. |
| **D-RT-02** | `apps/api/src/routes/quickstart.ts:23-86` | `/quickstart/opencode.sh` | `GET` | Endpoint publik (tanpa autentikasi) yang menyajikan bash script dinamis (`curl -fsSL ... \| bash`) untuk konfigurasi CLI `opencode` lokal. Menghasilkan JSON daftar model aktif. | **TIDAK ADA DI PRD** (PRD §14.5 hanya mencantumkan cuplikan kode dokumentasi dasbor, bukan shell installer publik). | 🟡 **Sedang:** Mengekspos daftar nama model aktif secara publik dan berisiko eksploitasi bila format template shell tidak lolos injeksi karakter. |
| **D-RT-03** | `apps/api/src/routes/catalog.ts:18-67` | `/v1/catalog/models`<br>`/v1/catalog/packages` | `GET` | Endpoint katalog model dan paket khusus dasbor web yang dilindungi `sessionAuth` (berbeda dari `/v1/models` yang dilindungi `apiKeyAuth`). | **TIDAK ADA DI PRD** (PRD hanya mendefinisikan `/v1/models` dengan Bearer API key). | 🟢 **Rendah:** Diperlukan secara arsitektural untuk dasbor web, namun belum diselaraskan ke dalam dokumen kontrak API. |
| **D-RT-04** | `apps/api/src/routes/redeem.ts:31-137` | `/v1/redeem` | `POST` | Endpoint penukaran voucher/promo code yang dapat memberikan reward berupa saldo kredit global atau paket **Entitlement** model tertentu. | **TERSEBUT SEBAGIAN** (PRD FR-BILL-09 menyebut voucher, tapi spesifikasi endpoint REST `/v1/redeem` tidak ada di PRD §14). | 🟡 **Sedang:** Kompleksitas logika transaksi dan reward paket berdurasi tidak terdokumentasi di PRD. |
| **D-RT-05** | `apps/web/src/app/api/backend/[...path]/route.ts` | `/api/backend/*` | `ALL` | Proxy handler internal Next.js App Router yang mem-forward request dasbor ke Hono backend API menggunakan header `x-internal-secret`. | **TIDAK ADA DI PRD** (Detail internal inter-service gateway). | 🟢 **Rendah:** Mekanisme reverse proxy internal frontend-to-backend. |
| **D-RT-06** | `apps/api/src/app.ts:63` | `/health` | `GET` | Endpoint health check dasar pada root server Hono yang mengembalikan `{ ok: true }` tanpa verifikasi dependensi DB/Redis. | **TIDAK ADA DI PRD** (PRD NFR-REL-03 menyebut health check dependensi). | 🟢 **Rendah:** Liveness check standar container/orchestrator. |

---

## 3. Matriks Skema Database & Entitas Tersembunyi (Undocumented DB Schema)

| No | Tabel / Kolom Drizzle | Definisi Tipe Data | Deskripsi Fungsi di Kode | Status di PRD | Analisis Dampak & Deviasi |
|---|---|---|---|---|---|
| **D-DB-01** | **Tabel `entitlements`**<br>`schema.ts:268-289` | `id, user_id, package_id, model_id, credit_allowance, credits_used, expires_at, status` | Sistem bucket saldo khusus per model dengan masa berlaku (*time-bound model pass*), misal kuota token DeepSeek khusus 24 jam. | **TIDAK ADA DI PRD** | PRD hanya merancang sistem saldo global (*single wallet balance*). Kehadiran tabel ini menciptakan arsitektur penagihan bercabang (*dual-source billing: balance vs entitlement*). |
| **D-DB-02** | **Kolom `packages.duration_hours`** & **`packages.model_id`**<br>`schema.ts:258-259` | `model_id: uuid`<br>`duration_hours: integer` | Mendukung paket langganan berbasis durasi waktu (misal pass 24 jam / 30 hari) yang terikat pada satu model spesifik. | **TIDAK ADA DI PRD** | Menandakan adanya fitur *Daily Pass / Model Pass* yang tidak pernah didefinisikan dalam modul paket top-up PRD FR-BILL-01. |
| **D-DB-03** | **Kolom `credit_ledger.source_type`** & **`reservations.source_type`**<br>`schema.ts:211, 233` | `enum('balance', 'entitlement')` | Menandai apakah pemotongan kredit memotong saldo dompet umum atau kuota paket entitlement model. | **TIDAK ADA DI PRD** | Deviasi logis terhadap perhitungan saldo PRD yang mengasumsikan satu dompet tunggal per pengguna. |
| **D-DB-04** | **Kolom `providers.circuit_breaker_state`**<br>`schema.ts:110` | `jsonb` | Menyimpan status circuit breaker (state, failureCount, lastFailureTime, consecutiveFailures) langsung di baris database PostgreSQL. | **DEVIASI PRD** | PRD §5.5 & AR-05 menyatakan state transient circuit breaker disimpan di Redis/in-memory, bukan di-query dan di-update ke PostgreSQL pada setiap request. |
| **D-DB-05** | **Kolom `packages.currency`** & **Overload `price_cents`**<br>`schema.ts:261, 260` | `currency: text ('IDR'\|'USD')`<br>`price_cents: integer` | Menyimpan mata uang paket. Namun nilai `price_cents` di-overload: jika IDR menyimpan nilai Rupiah penuh (Rp 5.000 disimpan sebagai `5000`), jika USD menyimpan sen ($5.00 disimpan sebagai `500`). | **DEVIASI PRD** | Nama kolom `price_cents` menyesatkan (*misleading semantic*) karena pada baris IDR bukan bernilai satuan sen melainkan unit nominal rupiah penuh. |
| **D-DB-06** | **Tabel `redeem_codes`** & **`redemptions`**<br>`schema.ts:352-390` | `code, reward_type, credit_amount, package_id, max_redemptions, redeemed_count, expires_at, active` | Tabel manajemen kode promosi dan pencatatan audit penukaran pengguna. | **TERSEBUT IMPLISIT** | Struktur skema tidak pernah didefinisikan dalam rancangan ERD/skema PRD §14.2. |
| **D-DB-07** | **Skrip `make-admin.ts`**<br>`packages/db/src/make-admin.ts` | Skrip CLI eksternal | Skrip `pnpm make-admin <email>` yang secara langsung mengubah kolom `users.role = 'admin'` di database tanpa audit log. | **TIDAK ADA DI PRD** | Alat administrasi backend luar jalur (*out-of-band privilege escalation*) tanpa jejak `admin_audit_log`. |

---

## 4. Analisis Mendalam Logika & Perilaku Sistem Tersembunyi (Hidden Behaviors)

### 4.1 Kurs Konversi Statis Hardcoded (1 USD = Rp 16.000)
- **Lokasi Kode:** `apps/api/src/routes/payments.ts:186-189`
  ```typescript
  // Step 7: Determine IDR amount (auto-convert if USD package at 1 USD = 16,000 IDR)
  const amountIDR =
    pkg.currency === 'IDR' || !pkg.currency
      ? pkg.priceCents
      : Math.round((pkg.priceCents / 100) * 16000);
  ```
- **Kondisi Tersembunyi:** Bila pengguna membeli paket berbasis USD menggunakan metode pembayaran Duitku (QRIS IDR), backend secara otomatis mengonversi harga menggunakan kurs tetap **Rp 16.000 per USD**.
- **Analisis Dampak:**
  - Tidak ada integrasi dengan API kurs valas real-time (Bank Indonesia / Fixer / Open Exchange Rates).
  - Jika kurs pasar USD menguat melebihi Rp 16.000 (misal Rp 16.500 atau Rp 16.800), platform mengalami kerugian selisih kurs pada setiap transaksi pembayaran QRIS untuk paket USD.
  - Perilaku ini sama sekali tidak didokumentasikan di PRD maupun syarat ketentuan pengguna.

---

### 4.2 Arsitektur Pendanaan Ganda: Entitlement vs Saldo Dompet (Dual-Source Billing)
- **Lokasi Kode:** `packages/db/src/billing.ts:73-98`
  ```typescript
  // Pick funding source: active model-matched entitlement first, then balance.
  export async function pickSource(userId: string, modelId: string, estimatedCredits: number, tx: any) {
    const [ent] = await tx.select().from(s.entitlements)
      .where(and(
        eq(s.entitlements.userId, userId),
        eq(s.entitlements.modelId, modelId),
        eq(s.entitlements.status, 'active'),
        gt(s.entitlements.expiresAt, new Date())
      ));
    if (ent && (ent.creditAllowance - ent.creditsUsed) >= estimatedCredits) {
      return { sourceType: 'entitlement', sourceId: ent.id };
    }
    // fallback to wallet balance...
  }
  ```
- **Kondisi Tersembunyi:** Sistem mengimplementasikan hierarki prioritas sumber dana yang cerdas: jika pengguna memiliki tiket paket (*entitlement*) aktif yang cocok dengan model yang dipanggil, kuota tiket tersebut yang dipotong terlebih dahulu sebelum menyentuh saldo dompet umum.
- **Analisis Dampak:**
  - Ini adalah fitur bernilai bisnis tinggi (*value-added feature*) yang sangat baik untuk promosi model baru atau paket langganan model tertentu.
  - **Masalah:** Fitur ini sepenuhnya merupakan *Shadow Feature* yang tidak ada dalam spesifikasi PRD FR-BILL. Akibatnya, tim pengembang dasbor dan dokumentasi publik tidak menampilkan masa berlaku atau sisa kuota entitlement ini secara jelas kepada pengguna.

---

### 4.3 Endpoint Mock Webhook Aktif di Lingkungan Produksi (`/webhooks/mock`)
- **Lokasi Kode:** `apps/api/src/routes/webhooks.ts:25-78`
  ```typescript
  webhooks.post('/mock', async (c) => {
    const raw = await c.req.text();
    if (!verifyMockSignature(raw, c.req.header('x-webhook-signature'))) {
      return c.json({ error: 'invalid signature' }, 401);
    }
    // ... langsung mengeksekusi processPaymentSuccess() dan mengisi saldo kredit
  });
  ```
- **Kondisi Tersembunyi:** Rute ini didaftarkan secara permanen di router webhooks tanpa pembungkusan kondisi `if (process.env.NODE_ENV !== 'production')`.
- **Analisis Dampak:**
  - Meskipun dilindungi verifikasi signature `MOCK_PAYMENT_WEBHOOK_SECRET`, membiarkan endpoint pembayaran mock aktif pada deployment produksi membuka celah keamanan serius (*unintended attack surface*). Jika variabel rahasia ini terisi secara default di server staging/produksi, siapa pun yang mengetahui format payload dapat memicu penambahan kredit riil.

---

### 4.4 In-Memory Throttling Map pada Lingkungan Stateless (`lastPollMap`)
- **Lokasi Kode:** `apps/api/src/routes/payments.ts:24`
  ```typescript
  // In-memory rate-limiter map to throttle polling requests (10-second window per payment ID)
  const lastPollMap = new Map<string, number>();
  ```
- **Kondisi Tersembunyi:** Pembatasan frekuensi pengecekan status pembayaran Duitku (maksimal 1 kali tiap 10 detik per invoice) disimpan dalam memori RAM lokal proses Node.js/Bun.
- **Analisis Dampak:**
  - PRD menetapkan Redis sebagai infrastruktur caching dan rate limiting terdistribusi (AR-05).
  - Penggunaan struktur data `Map()` lokal di dalam memori proses akan kehilangan efektivitas saat API di-deploy di platform multi-instance (serverless container, Kubernetes, atau auto-scaling group), karena request polling berikutnya dapat dilayani oleh instance lain yang memiliki map kosong.

---

### 4.5 Background Cron Jobs Terintegrasi Langsung di Thread Server API
- **Lokasi Kode:** `apps/api/src/index.ts:24-65`
  ```typescript
  setInterval(sweepExpiredReservations, 60_000);
  setInterval(purgeInterval, 24 * 60 * 60_000);
  setInterval(checkProviderHealth, ALERT_CHECK_INTERVAL_MS);
  setInterval(sweepStaleDuitkuPayments, 60_000);
  setInterval(reconcilePaypalPayments, PAYPAL_RECONCILE_MS);
  ```
- **Kondisi Tersembunyi:** Seluruh pekerjaan berkala (*background scheduled tasks*) dijalankan menggunakan fungsi bawaan `setInterval` di dalam proses HTTP server utama API, bukan melalui worker terpisah atau Redis queue (BullMQ/Temporal).
- **Analisis Dampak:**
  - Jika server API dijalankan lebih dari 1 instance (horizontal scaling), pekerjaan rekonsiliasi PayPal dan pembatalan Duitku akan dieksekusi secara redundan dan bersamaan oleh tiap instance, memicu persaingan query (*database locking contention*) yang tidak perlu.

---

### 4.6 Pembatasan Metode Pembayaran Duitku Khusus QRIS
- **Lokasi Kode:** `apps/api/src/routes/payments.ts:27`
  ```typescript
  // Allowed Duitku payment methods whitelist restricted to QRIS channels without fee discrepancies
  const ALLOWED_DUITKU_PAYMENT_METHODS = new Set(['SP', 'LQ', 'NQ']);
  ```
- **Kondisi Tersembunyi:** Sistem secara keras (*hardcoded*) membatasi kanal pembayaran Duitku hanya untuk kode `SP` (ShopeePay QRIS), `LQ` (LinkAja QRIS), dan `NQ` (Nobu National QRIS). Metode Virtual Account (BCA, Mandiri, BRI) atau e-wallet lain diblokir pada tingkat kode.
- **Analisis Dampak:**
  - PRD FR-BILL-02 menyatakan integrasi dengan payment gateway lokal (Duitku) untuk mendukung berbagai metode lokal populer di Indonesia.
  - Pembatasan khusus 3 kanal QRIS ini tidak disebutkan di PRD, meskipun secara operasional keputusan ini masuk akal untuk menghindari selisih biaya komisi payment gateway.

---

## 5. Matriks Risiko Fitur Tidak Terdokumentasi (Attack Surface & Shadow Risk)

| ID Temuan | Komponen / Fitur | Sifat Temuan | Skenario Risiko / Bahaya | Tingkat Keparahan | Rekomendasi Tindakan |
|---|---|---|---|---|---|
| **D-SK-01** | Endpoint `/webhooks/mock` | Shadow Endpoint | Pihak tak berwenang memanggil endpoint mock untuk grant kredit gratis jika secret bocor/tertebak. | 🟠 **Tinggi** | Nonaktifkan rute ini di production (`NODE_ENV === 'production'`). |
| **D-SK-02** | Kurs Tetap 16.000 IDR/USD | Hardcoded Constant | Fluktuasi nilai tukar riil menyebabkan kerugian finansial arbitrase kurs pada pembayaran Duitku. | 🟡 **Sedang** | Pindahkan nilai kurs ke tabel konfigurasi dinamis atau integrasikan feed kurs. |
| **D-SK-03** | Skrip `make-admin.ts` | Shadow Admin Script | Eskalasi hak istimewa sepihak tanpa jejak `admin_audit_log` dan tanpa pengawasan dual-control. | 🟡 **Sedang** | Tambahkan pencatatan otomatis ke `admin_audit_log` saat skrip dijalankan. |
| **D-SK-04** | In-Memory `lastPollMap` | Stateless Bypass | Polling status ke Duitku dapat membanjiri upstream jika request diarahkan bergantian ke instance berbeda. | 🔵 **Rendah** | Pindahkan tracking polling status pembayaran ke Redis dengan key bertarget TTL 10s. |
| **D-SK-05** | Public `/quickstart/opencode.sh` | Undocumented Endpoint | Modifikasi kode upstream pada shell script dapat berisiko dieksekusi langsung oleh ribuan mesin klien pengguna. | 🟡 **Sedang** | Berikan pin versi aman, dokumentasikan di PRD, dan terapkan header Content-Security-Policy ketat. |
| **D-SK-06** | Semantik `price_cents` IDR | Schema Confusion | Developer baru salah mengira nominal IDR adalah sen (dibagi 100), mengakibatkan salah hitung tagihan. | 🟡 **Sedang** | Dokumentasikan konvensi kolom di schema atau pisahkan menjadi `price_minor_units`. |

---

## 6. Kesimpulan Tahap D & Rekomendasi Penyelarasan

1. **Sinkronisasi Dokumen PRD:**
   PRD v1.0 perlu diperbarui dengan *Addendum* resmi untuk mendokumentasikan:
   - Fitur **Entitlements & Model Pass** (tabel `entitlements`, masa berlaku per model, prioritas pendanaan `pickSource`).
   - Endpoint publik `/quickstart/opencode.sh` dan katalog dasbor `/v1/catalog/*`.
   - Aturan pembatasan kanal QRIS Duitku (`SP`, `LQ`, `NQ`) dan formula konversi kurs mata uang paket.

2. **Pembersihan Kode Produksi (Sanitization):**
   - Rute `/webhooks/mock` **wajib** dipagari agar tidak dapat diakses sama sekali ketika aplikasi berjalan di lingkungan produksi (`NODE_ENV === 'production'`).
   - Logika polling payment di `payments.ts` harus dipindahkan dari `Map()` RAM lokal ke Redis.
   - Background tasks di `apps/api/src/index.ts` perlu diberi mekanisme locking distributed (Redis Redlock) jika aplikasi di-deploy pada skala multi-pod/multi-container.

---

*Laporan Tahap D selesai disusun. Hasil ini menjadi masukan untuk Tahap E (Kesesuaian Skema Database & Spesifikasi API Kontrak).*
