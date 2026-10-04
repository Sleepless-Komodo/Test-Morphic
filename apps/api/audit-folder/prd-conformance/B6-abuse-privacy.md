# LAPORAN TAHAP B6: FR-ABU, FR-NOT & FR-PRV (Anti-Abuse, Notifikasi & Privasi)

**Tanggal Audit:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Modul:** FR-ABU-01..07, FR-NOT-01..04, FR-PRV-01..05, DATA-01..12, LEGAL-01..08, AI-02, AI-08, AI-11, KEY-08, KEY-10, LOG-04, T-05  
**File Kode Diperiksa:**
- [`apps/api/src/middleware/session-ratelimit.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/middleware/session-ratelimit.ts)
- [`apps/api/src/ratelimit.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/ratelimit.ts)
- [`apps/api/src/lib/alert.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/lib/alert.ts)
- [`apps/api/src/middleware/auth.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/middleware/auth.ts)
- [`apps/web/src/lib/auth.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/auth.ts)
- [`apps/web/src/app/terms/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/terms/page.tsx)
- [`apps/web/src/app/privacy/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/privacy/page.tsx)
- [`apps/web/src/app/dashboard/settings/settings-view.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/dashboard/settings/settings-view.tsx)
- [`apps/web/src/lib/actions.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/actions.ts)
- [`packages/db/src/schema.ts`](file:///c:/Users/esc/Desktop/morphic/packages/db/src/schema.ts)

---

## 1. Tabel Pemetaan FR-ABU (Anti-Abuse & Kepercayaan)

| ID PRD | Kebutuhan PRD | Prioritas / Fase | Status | Bukti Kode (file:baris) | Penjelasan & Bukti Lapangan |
|---|---|---|---|---|---|
| **FR-ABU-01** | Rate limit bertingkat (per IP, akun, key, global). Spoofing `X-Forwarded-For` tidak bisa bypass. | M (Must) / Fase 1 | **PARTIAL / RISK** | `session-ratelimit.ts:4-9`; `ratelimit.ts:103-152`; `auth.ts:81-100` | **Terpenuhi:** Rate limit per-key (120 RPM) & concurrency limit (5) di gateway; rate limit per-user+IP di rute session manajemen.<br>**Kelemahan Kritis:** (1) Ekstraksi IP di `session-ratelimit.ts:7` memakai elemen pertama `xff.split(',')[0]` tanpa validasi reverse proxy terpercaya, rentan spoofing; (2) Endpoint inferensi gateway (`/v1/chat/completions`) **tidak memiliki rate limit IP**, hanya per key ID. |
| **FR-ABU-02** | Deteksi anomali (lonjakan, banyak IP/geo, pola carding). Alert < 5 menit sejak pola terdeteksi. | M (Must) / Fase 1 | **MISSING** | `lib/alert.ts:74-120` | Modul `alert.ts` hanya memonitor error rate hulu provider (>50%). **Tidak ada sistem deteksi anomali perilaku pengguna** (lonjakan penggunaan tidak wajar, multi-IP/geo hopping, atau pola serangan bot). |
| **FR-ABU-03** | Auto-suspend + notifikasi pemilik saat abuse terdeteksi. Dapat diajukan banding via support. | M (Must) / Fase 1 | **MISSING** | — | Suspensi akun saat ini hanya dapat dilakukan secara manual oleh admin melalui tombol di `/admin/users`. Tidak ada sistem auto-suspend otomatis berbasis ambang batas anomali. |
| **FR-ABU-04** | Persetujuan AUP saat daftar. Versi AUP yang disetujui dicatat. | M (Must) / Fase 1 | **PARTIAL** | `terms/page.tsx:80-85`; `schema.ts:16-30` | Kebijakan Acceptable Use Policy (AUP) tercantum di `/terms`. Namun di database (`users` table), tidak ada kolom `aup_version` atau `tos_version` untuk mencatat nomor versi yang disepakati pengguna saat registrasi (T-B1-07). |
| **FR-ABU-05** | Kanal laporan abuse + proses takedown. SLA tinjauan tercatat. | S (Should) / Fase 1 | **MISSING** | `terms/page.tsx`; `settings-view.tsx:162` | Tidak ada kanal atau formulir pelaporan abuse khusus (hanya ada email `support@morphic.sh`), dan tidak ada SLA tinjauan takedown yang terdokumentasi secara formal. |
| **FR-ABU-06** | KYC bertingkat untuk pengeluaran tinggi. Ambang terkonfigurasi; data KYC terenkripsi. | S (Should) / Fase 2 | **MISSING** | — | Fitur KYC belum diimplementasikan di sistem. (Sesuai roadmap PRD, dialokasikan untuk Fase 2). |
| **FR-ABU-07** | Anti-fraud top-up (3DS, risk score, hold dana awal). Top-up berisiko ditahan/ditolak. | M (Must) / Fase 1 | **PARTIAL** | `payments.ts:67-87, 180`; `paypal-reconcile.ts:14-16` | **Terpenuhi:** Rate limit 5 pembuatan invoice per jam per user, TTL 5 menit untuk QRIS Duitku, verifikasi nominal ketat.<br>**Gap:** Tidak ada integrasi risk score pihak ketiga atau penahanan dana bersyarat. |

---

## 2. Tabel Pemetaan FR-NOT (Notifikasi & Dukungan)

| ID PRD | Kebutuhan PRD | Prioritas / Fase | Status | Bukti Kode (file:baris) | Penjelasan & Bukti Lapangan |
|---|---|---|---|---|---|
| **FR-NOT-01** | Email transaksional: verifikasi, reset, top-up, saldo rendah, key dibuat/dicabut, login baru, suspend. | M (Must) / Fase 1 | **MISSING** | `lib/auth.ts:80-84`; `packages/` | **Ketiadaan Total Email Provider:** Tidak ada library pengiriman email (Resend, Nodemailer, SendGrid, SES, SMTP) di seluruh codebase backend maupun frontend. Tidak ada satu pun email transaksional yang dikirimkan oleh platform. |
| **FR-NOT-02** | Pusat bantuan + formulir tiket/kontak keamanan. | M (Must) / Fase 1 | **MISSING** | `settings-view.tsx:162` | Tidak ada modul help center, sistem tiket dukungan, atau form pelaporan kontak keamanan (hanya tautan tombol salin alamat email `support@morphic.sh`). |
| **FR-NOT-03** | Notifikasi insiden/pemeliharaan (email + status page). | S (Should) / Fase 1 | **MISSING** | — | Tidak ada status page publik dan tidak ada broadcast email pemeliharaan. |
| **FR-NOT-04** | Webhook notifikasi ke pelanggan (saldo rendah, limit). | C (Could) / Fase 3 | **MISSING** | — | Belum diimplementasikan. (Sesuai roadmap PRD, dialokasikan untuk Fase 3). |

---

## 3. Tabel Pemetaan FR-PRV (Privasi & Data Pribadi)

| ID PRD | Kebutuhan PRD | Prioritas / Fase | Status | Bukti Kode (file:baris) | Penjelasan & Bukti Lapangan |
|---|---|---|---|---|---|
| **FR-PRV-01** | Ekspor data pribadi (DSAR). Selesai ≤ 30 hari (target internal ≤ 7 hari). | M (Must) / Fase 1 | **MISSING** | `settings-view.tsx:240-350`; `schema.ts` | Tidak ada tombol atau antarmuka DSAR (Data Subject Access Request) untuk mengunduh arsip data profil pengguna. Tabel `dsar_requests` (DM-ENT-15) tidak ada. |
| **FR-PRV-02** | Penghapusan akun dan data terkait. Data terhapus sesuai retensi; konfirmasi tertulis. | M (Must) / Fase 1 | **PARTIAL / RISK** | `settings-view.tsx:610-709`; `actions.ts:50-70`; `schema.ts:184, 195` | **Terpenuhi:** Pengguna dapat menghapus akun sendiri via modal konfirmasi ketik email.<br>**Pelanggaran Kritis (T-B1-05):** Penghapusan mengeksekusi `db.delete(users)` yang secara CASCADE menghapus baris transaksi keuangan `credit_ledger` dan `payments`, melanggar DM-RULE-05 (data keuangan wajib dipertahankan untuk retensi audit/pajak). |
| **FR-PRV-03** | Persetujuan cookie dan pengaturan privasi. Cookie non-esensial hanya aktif setelah persetujuan. | M (Must) / Fase 1 | **MISSING** | `apps/web/src/app/layout.tsx` | Tidak ada Cookie Consent Banner atau panel preferensi privasi cookie sebelum sesi aktif. |
| **FR-PRV-04** | Pengaturan retensi log opt-in (debug) dengan TTL. Default nonaktif; TTL maksimal terdefinisi. | S (Should) / Fase 1 | **MISSING** | `middleware/logger.ts`; `schema.ts` | Platform menerapkan Zero Data Retention murni secara permanen; tidak ada opsi opt-in debug logging dengan TTL sementara untuk pengembang. |
| **FR-PRV-05** | Daftar sub-prosesor publik + DPA yang dapat diunduh. Diperbarui saat ada perubahan. | S (Should) / Fase 1 | **MISSING** | `privacy/page.tsx:42-92` | Halaman `/privacy` menjelaskan prinsip ZDR dan gateway Duitku, tetapi **tidak memuat daftar inventaris sub-prosesor pihak ketiga** (cloud host, DB host, AI upstream vendors) dan tidak menyediakan DPA (Data Processing Agreement) yang dapat diunduh. |

---

## 4. Tabel Pemetaan Kontrol Keamanan Terkait (DATA, LEGAL, AI, ABU)

| ID Kontrol | Deskripsi Kontrol Keamanan | Status | Bukti Kode (file:baris) | Evaluasi & Rekomendasi Auditor |
|---|---|---|---|---|
| **DATA-01** | Enkripsi data saat transit (TLS 1.2+ wajib) di semua endpoint. | **IMPLEMENTED** | `next.config.mjs:53-55` | HSTS `max-age=31536000` aktif di mode produksi. Seluruh API menggunakan protokol HTTPS. |
| **DATA-02** | Enkripsi data at-rest untuk data sensitif di database. | **IMPLEMENTED** | `shared/keys.ts`; `provider-crypto.ts` | Kredensial provider dienkripsi AES-256-GCM. Hash API key disimpan dengan SHA-256. |
| **DATA-04** | Hak akses data (DSAR): pengguna dapat meminta salinan seluruh data pribadi mereka. | **FAILED** | `settings-view.tsx` | Belum ada mekanisme pemenuhan hak akses data subjek (DSAR). |
| **DATA-05** | Hak penghapusan (Right to be Forgotten): penghapusan akun mematuhi retensi hukum data keuangan. | **FAILED** | `actions.ts:73`; `schema.ts:195` | Penghapusan akun secara ceroboh menghapus baris mutasi ledger keuangan (CWE-404 / pelanggaran DM-RULE-05). |
| **DATA-07** | Cookie non-esensial memerlukan persetujuan eksplisit (cookie consent). | **MISSING** | `app/layout.tsx` | Tidak ada modul manajemen persetujuan cookie. |
| **LEGAL-04**| Kepatuhan perpajakan (PPN / Sales Tax) dicantumkan secara transparan. | **MISSING** | `schema.ts:253-266` | Tidak ada rincian dasar pengenaan pajak (DPP) dan PPN 11%/12%. |
| **LEGAL-05**| Daftar sub-prosesor pihak ketiga dipublikasikan dan DPA tersedia. | **MISSING** | `privacy/page.tsx` | Belum ada daftar sub-prosesor resmi dan draft DPA yang dapat diunduh. |
| **LEGAL-08**| Penanganan laporan penyalahgunaan memiliki alur investigasi dan SLA takedown. | **MISSING** | `terms/page.tsx` | Tidak ada dokumen SLA respons laporan abuse. |
| **AI-02**   | Zero Data Retention untuk prompt dan completion di persistent store. | **IMPLEMENTED** | `schema.ts:173-196`; `logger.ts` | Konten prompt dan completion tidak pernah disimpan di disk atau database. |
| **AI-08**   | Acceptable Use Policy ditegakkan; audit abuse berbasis metadata tanpa melihat isi prompt. | **PARTIAL** | `terms/page.tsx:80-85` | AUP didefinisikan di ToS, tetapi antrean review abuse dan pencatatan versi AUP pengguna belum ada. |
| **KEY-08**  | Rate limit bertingkat untuk mencegah penyalahgunaan API. | **PARTIAL** | `ratelimit.ts:103-152` | Rate limit per-key aktif, namun rate limit per-IP pada gateway hulu belum terpasang. |
| **LOG-04**  | Alerting otomatis untuk insiden keamanan dan kegagalan hulu. | **PARTIAL** | `lib/alert.ts:124-164` | Alert Telegram aktif untuk kegagalan provider hulu, tetapi belum ada alert untuk anomali akun/abuse. |

---

## 5. Temuan Keamanan & Kepatuhan — Diurutkan Berdasarkan Risiko

### 🟠 TINGGI — T-B6-01: Ketiadaan Infrastruktur Pengiriman Email Transaksional (Semua Notifikasi Email Mati)
- **ID PRD Terkait:** FR-NOT-01, FR-AUTH-01, FR-AUTH-03
- **Butir Audit:** FR-NOT-01 (Transactional Email Delivery Infrastructure)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/web/src/lib/auth.ts:80-84`](file:///c:/Users/esc\Desktop\morphic\apps\web\src\lib\auth.ts#L80-L84):
  ```typescript
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  ```
  Tidak ada implementasi `sendVerificationEmail` atau `sendResetPasswordEmail` pada konfigurasi Better Auth.
  Di seluruh direktori `apps/` dan `packages/`, tidak ada package email sender (Resend, Nodemailer, SendGrid, Mailgun, AWS SES).
- **Dampak Keamanan & Bisnis:**
  1. **Akun Tanpa Verifikasi Kepemilikan:** Pengguna dapat mendaftarkan akun menggunakan alamat email milik orang lain dan langsung otomatis login (`autoSignIn: true`) tanpa pernah membuktikan kepemilikan email.
  2. **Reset Password Tidak Berfungsi:** Fitur lupa password tidak dapat mengirimkan token verifikasi ke inbox pengguna.
  3. **Ketiadaan Alert Transaksional:** Pengguna tidak menerima bukti pembelian top-up, tidak mendapat peringatan saat saldo mendekati habis, dan tidak mendapat notifikasi saat akun diakses dari perangkat baru.
- **Mitigasi Cepat:**
  Pasang library email provider (misal `@react-email` + `resend` atau `nodemailer`) dan sambungkan callback `sendVerificationEmail` serta `sendResetPasswordEmail` pada Better Auth di `apps/web/src/lib/auth.ts`.

---

### 🟠 TINGGI — T-B6-02: Ketiadaan Sarana Ekspor Data Pribadi (DSAR) untuk Kepatuhan Regulasi Privasi
- **ID PRD Terkait:** FR-PRV-01, DATA-04, POL-DATA-04
- **Butir Audit:** DATA-04 (Data Subject Access Request Fulfillment)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  Di `apps/web/src/app/dashboard/settings/settings-view.tsx`, hanya tersedia informasi profil dasar dan tombol hapus akun permanen.
  Tidak ada endpoint, fungsi backend, atau tabel database (`dsar_requests`, DM-ENT-15) untuk memproses permintaan ekspor data subjek.
- **Dampak Keamanan & Bisnis:**
  Pelanggaran terhadap regulasi perlindungan data pribadi (UU No. 27/2022 tentang Perlindungan Data Pribadi Pasal 21 dan GDPR Pasal 15). Pengguna tidak memiliki hak mandiri untuk mengunduh seluruh data yang tersimpan tentang diri mereka.
- **Mitigasi Cepat:**
  Buat Server Action `requestPersonalDataExportAction()` yang mengumpulkan profil akun, daftar API key (masked), riwayat transaksi, dan riwayat penggunaan ke dalam satu file arsip JSON terenkripsi/terproteksi password untuk diunduh pengguna.

---

### 🟡 SEDANG — T-B6-03: Ekstraksi IP Klien Rentan terhadap Spoofing Header `X-Forwarded-For` & Ketiadaan Rate Limiting IP pada Gateway Inferensi
- **ID PRD Terkait:** FR-ABU-01, T-05, KEY-08
- **Butir Audit:** T-05 (IP Spoofing Resistance), KEY-08 (Tiered Rate Limiting)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/middleware/session-ratelimit.ts:5-8`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\middleware\session-ratelimit.ts#L5-L8):
  ```typescript
  function clientIp(c: Context): string {
    const xff = c.req.header('x-forwarded-for');
    if (xff) return xff.split(',')[0]!.trim();
    return c.req.header('x-real-ip') ?? 'unknown';
  }
  ```
  [`apps/api/src/routes/v1.ts:16-18`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\v1.ts#L16-L18):
  ```typescript
  v1.use('/chat/*', apiKeyAuth, gatewayGuards({ rpm: 120, concurrency: 5 }));
  ```
- **Dampak Keamanan & Bisnis:**
  1. Pada rute sesi, penyerang dapat memanipulasi header `X-Forwarded-For: 1.2.3.4` untuk memintas atau mengacaukan penghitungan bucket rate limit IP.
  2. Pada rute gateway `/v1/chat/completions`, rate limit hanya dihitung berdasarkan `keyId`. Tidak ada pembatas IP. Jika satu API key valid dibagikan atau digunakan oleh botnet ratusan IP secara bersamaan, gateway tidak membatasi lonjakan IP ekstrem per key.
- **Mitigasi Cepat:**
  1. Di lingkungan produksi (Vercel/Cloudflare/AWS), ambil IP hanya dari header tepercaya edge proxy (misal `c.req.header('cf-connecting-ip')` atau `x-forwarded-for` elemen terakhir dari reverse proxy terpercaya).
  2. Tambahkan lapisan rate limiter IP global (mis. max 300 RPM per IP) di middleware gateway `v1.ts`.

---

### 🟡 SEDANG — T-B6-04: Ketiadaan Monitoring Deteksi Anomali Perilaku Pengguna & Ketiadaan Auto-Suspend Berbasis Abuse
- **ID PRD Terkait:** FR-ABU-02, FR-ABU-03, KEY-10, LOG-04
- **Butir Audit:** KEY-10 (Automated Abuse Detection & Auto-Suspension)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/lib/alert.ts:74-120`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\lib\alert.ts#L74-L120):
  Sistem hanya memonitor metrik kegagalan HTTP provider hulu. Tidak ada algoritma atau query periodik yang mendeteksi:
  - Lonjakan konsumsi token mendadak (spike >1000% dari rata-rata).
  - Panggilan API key yang sama dari puluhan negara/IP berbeda dalam hitungan detik.
  - Percobaan pembuatan token/invoice berulang (card testing).
- **Dampak Keamanan & Bisnis:**
  Akun yang mengalami kebocoran API key atau digunakan untuk serangan scraping agresif tidak dapat dibendung secara otomatis dalam waktu < 5 menit. Kerugian saldo atau tagihan hulu akan terus membengkak sampai ada laporan manual dari pengguna atau admin.
- **Mitigasi Cepat:**
  Pasang cron job ringan setiap 5 menit yang mendeteksi key dengan tingkat error 4xx/5xx abnormal atau lonjakan RPM ekstrem, lalu secara otomatis menandai status key menjadi `suspended` dan mengirimkan alert darurat via Telegram.

---

### 🟡 SEDANG — T-B6-05: Ketiadaan Spanduk Persetujuan Cookie (Cookie Consent Banner)
- **ID PRD Terkait:** FR-PRV-03, DATA-07
- **Butir Audit:** DATA-07 (Cookie & Privacy Preference Management)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  Di `apps/web/src/app/layout.tsx`, tidak ada komponen banner persetujuan cookie.
- **Dampak Keamanan & Bisnis:**
  Ketidakpatuhan terhadap regulasi privasi global (GDPR / ePrivacy Directive / UU PDP) mengenai penyimpanan cookie pada peramban pengguna sebelum mendapatkan persetujuan aktif.
- **Mitigasi Cepat:**
  Pasang komponen banner cookie sederhana di root layout yang meminta persetujuan pengguna untuk cookie esensial dan preferensi tema/bahasa.

---

### 🟡 SEDANG — T-B6-06: Ketiadaan Pusat Bantuan Formal, Formulir Tiket, & Kanal Khusus Laporan Abuse
- **ID PRD Terkait:** FR-NOT-02, FR-ABU-05, LEGAL-08
- **Butir Audit:** LEGAL-08 (Abuse Intake Channel & Takedown SLA)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  Di `terms/page.tsx` dan `settings-view.tsx:162`, kontak hanya berupa teks statis `support@morphic.sh`. Tidak ada formulir pelaporan insiden keamanan (security vulnerability disclosure) dan tidak ada kanal pelaporan konten ilegal/abuse.
- **Dampak Keamanan & Bisnis:**
  Pihak luar yang menemukan penyalahgunaan API atau celah keamanan tidak memiliki alur pelaporan terstruktur dengan SLA penanganan yang jelas.
- **Mitigasi Cepat:**
  Sediakan halaman kontak publik `/contact` atau `/security` dengan formulir terstruktur untuk pelaporan tiket bantuan, kerentanan keamanan, dan laporan abuse.

---

### 🔵 RENDAH — T-B6-07: Daftar Sub-Prosesor Pihak Ketiga & Dokumen DPA Belum Dipublikasikan
- **ID PRD Terkait:** FR-PRV-05, LEGAL-05
- **Butir Audit:** LEGAL-05 (Public Sub-Processor Directory & DPA)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/web/src/app/privacy/page.tsx:82-92`](file:///c:/Users/esc\Desktop\morphic\apps\web\src\app\privacy\page.tsx#L82-L92):
  Hanya menyebutkan gateway Duitku secara umum tanpa tabel rincian sub-prosesor (misal Neon DB, Vercel, Upstream AI vendors) dan tanpa tautan unduh DPA.
- **Dampak:** Klien korporasi tidak dapat melengkapi berkas vendor risk assessment mereka.
- **Mitigasi Cepat:** Tambahkan bagian tabel sub-prosesor di halaman Kebijakan Privasi dan sediakan template DPA yang dapat diunduh.

---

### 🔵 RENDAH — T-B6-08: Fitur Retensi Log Opt-In Debug dengan TTL Belum Tersedia
- **ID PRD Terkait:** FR-PRV-04, AI-02
- **Butir Audit:** AI-02 (Opt-In Debug Retention with TTL)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:** Sistem menerapkan zero-retention permanen secara kaku.
- **Dampak:** Pengembang tidak memiliki opsi untuk mengaktifkan log debug sementara saat mengalami error integrasi API yang rumit.
- **Mitigasi Cepat:** Sediakan opsi toggle debug opt-in dengan masa kedaluwarsa otomatis (TTL maksimal 24 jam) jika dibutuhkan pengembang.

---

### 🔵 RENDAH — T-B6-09: Modul KYC Bertingkat Belum Diimplementasikan (Fase 2)
- **ID PRD Terkait:** FR-ABU-06, LEGAL-06
- **Status di PRD:** Fase 2 ('Should').

---

### 🔵 RENDAH — T-B6-10: Webhook Notifikasi ke Sistem Pelanggan Belum Tersedia (Fase 3)
- **ID PRD Terkait:** FR-NOT-04
- **Status di PRD:** Fase 3 ('Could').

---

## 6. Analisis Mendalam atas 6 Pertanyaan Kunci Anti-Abuse & Privacy Conformance

### 1. Keandalan Rate Limiting Bertingkat & Ketahanan Spoofing (FR-ABU-01 & T-05)
- Sistem memiliki rate limiter berbasis fixed-window di Redis/In-memory (`ratelimit.ts`).
- Kelemahan: Ekstraksi IP pada rute sesi menggunakan elemen pertama `X-Forwarded-For` tanpa filter reverse proxy tepercaya, dan rute gateway inferensi `/v1/chat/*` sama sekali tidak memiliki proteksi rate limiting per-IP (T-B6-03).

### 2. Kesiapan Respon Serangan & Deteksi Anomali Perilaku (FR-ABU-02 & FR-ABU-03)
- Modul alert (`alert.ts`) hanya memantau error rate upstream hulu via Telegram.
- Tidak ada analitik deteksi anomali pengguna (lonjakan kuota drastis, perpindahan IP mencurigakan, card testing). Seluruh tindakan mitigasi abuse bergantung pada tindakan manual admin.

### 3. Infrastruktur Komunikasi & Email Transaksional (FR-NOT-01)
- Ketiadaan total email provider di seluruh platform merupakan salah satu kelemahan arsitektur paling signifikan pada sistem Morphic saat ini (T-B6-01). Seluruh notifikasi kritis (verifikasi email, reset password, bukti bayar, notifikasi saldo) tidak dapat terkirim ke pengguna.

### 4. Kepatuhan Penghapusan Akun vs Retensi Keuangan (FR-PRV-02, DATA-05, DM-RULE-05)
- Fitur hapus akun mandiri tersedia di dashboard settings.
- Namun mekanisme eksekusinya menggunakan PostgreSQL `ON DELETE CASCADE` yang menghapus seluruh baris ledger mutasi keuangan dan riwayat pembayaran pengguna, melanggar prinsip retensi data keuangan untuk audit akuntansi dan perpajakan (T-B1-05).

### 5. Pemenuhan Hak Privasi Subjek Data / DSAR (FR-PRV-01 & DATA-04)
- Sistem belum menyediakan mekanisme ekspor data pribadi (DSAR). Tidak ada tabel pelacakan permohonan privasi dan tidak ada fitur unduh data akun terpadu (T-B6-02).

### 6. Transparansi Regulasi Hukum & Rantai Sub-Prosesor (FR-PRV-05 & LEGAL-05)
- Kebijakan Privasi (`/privacy`) dan Syarat Layanan (`/terms`) telah memuat klausul Zero Data Retention dengan jelas.
- Namun daftar sub-prosesor pihak ketiga belum dirinci dan berkas DPA standar belum disediakan untuk pengguna enterprise (T-B6-07).

---

## 7. Rekapitulasi Status & Matriks Risiko

### 7.1 Ringkasan Status Kebutuhan (16 Butir Gabungan)
| Modul | Implemented | Partial | Missing / Violation | Total |
|---|---|---|---|---|
| **FR-ABU** (Anti-Abuse) | 0 | 4 | 3 | 7 |
| **FR-NOT** (Notifikasi) | 0 | 0 | 4 | 4 |
| **FR-PRV** (Privasi Data) | 0 | 1 | 4 | 5 |
| **TOTAL** | **0 (0.0%)** | **5 (31.3%)** | **11 (68.7%)** | **16 (100%)** |

### 7.2 Matriks Temuan Berdasarkan Keparahan
| Tingkat Keparahan | Jumlah | Kode Temuan |
|---|---|---|
| 🔴 **Kritis** | 0 | — |
| 🟠 **Tinggi** | 2 | T-B6-01, T-B6-02 |
| 🟡 **Sedang** | 4 | T-B6-03, T-B6-04, T-B6-05, T-B6-06 |
| 🔵 **Rendah** | 4 | T-B6-07, T-B6-08, T-B6-09, T-B6-10 |
| **TOTAL TEMUAN** | **10** | |

### 7.3 Prioritas Tindakan Perbaikan
1. **P0 (Infrastruktur Dasar Kritis):**
   - Integrasikan penyedia email transaksional (Resend / Nodemailer) untuk verifikasi email pendaftaran dan reset password (T-B6-01).
   - Perbaiki fungsi hapus akun agar melakukan soft-delete / anonisasi profil tanpa menghapus riwayat ledger transaksi keuangan (T-B1-05).
2. **P1 (Kepatuhan Regulasi & Keamanan Anti-Abuse):**
   - Bangun fitur ekspor data pribadi (DSAR) mandiri di dashboard settings (T-B6-02).
   - Perbaiki ekstraksi IP dari header proxy dan pasang rate limiter IP pada rute gateway inferensi (T-B6-03).
   - Pasang deteksi anomali lonjakan trafik pengguna dan notifikasi abuse otomatis (T-B6-04).
   - Pasang banner persetujuan cookie (T-B6-05) dan formulir tiket/laporan kontak resmi (T-B6-06).
3. **P2 (Kelengkapan Transparansi Legal):**
   - Publikasikan daftar sub-prosesor dan draft DPA di halaman Kebijakan Privasi (T-B6-07).

---

## 8. Informasi Wajib Penutup B6 & Update Handoff

### 8.1 File yang Sudah Dibaca Lengkap
1. `apps/api/src/middleware/session-ratelimit.ts` (27 baris)
2. `apps/api/src/ratelimit.ts` (152 baris)
3. `apps/api/src/lib/alert.ts` (166 baris)
4. `apps/web/src/lib/auth.ts` (109 baris)
5. `apps/web/src/app/terms/page.tsx` (103 baris)
6. `apps/web/src/app/privacy/page.tsx` (99 baris)
7. `apps/web/src/app/dashboard/settings/settings-view.tsx` (712 baris)
8. `apps/web/src/lib/actions.ts` (574 baris)
9. `packages/db/src/schema.ts` (435 baris)

### 8.2 Hal yang Butuh Uji Manual di Staging
1. Uji pengiriman header `X-Forwarded-For` palsu pada endpoint sesi untuk memverifikasi perilaku rate limiter IP.
2. Uji alur penghapusan akun mandiri untuk memastikan konsistensi integritas relasi foreign key pada database.
3. Uji perilaku gateway saat satu API key dihujani request konkurensi tinggi dari multi-IP serentak.
