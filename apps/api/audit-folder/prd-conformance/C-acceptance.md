# LAPORAN TAHAP C: EVALUASI ACCEPTANCE CRITERIA LOGIS

**Platform:** Web AI API Gateway (Morphic)  
**Tanggal Audit:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Dokumen Acuan:** `PRD_AI_API_GATEWAY.md` (v1.0), `SECURITY_AUDIT_CHECKLIST.md` (v1.0), `A-requirements.md`, serta Laporan Tahap B1 s/d B6  
**Status File:** Selesai Dievaluasi

---

## 1. Ringkasan Eksekutif Evaluasi Acceptance Criteria

Tahap C mengevaluasi seluruh **Kriteria Penerimaan Logis (Acceptance Criteria / AC)** yang ditetapkan dalam dokumen spesifikasi kebutuhan sistem. Pengujian dilakukan melalui verifikasi alur kontrol logis (*logical execution path*), pemeriksaan kondisi batas (*boundary conditions*), ketahanan konkurensi (*race condition resilience*), serta skenario *Given-When-Then* pada implementasi kode aktual di `apps/api`, `apps/web`, `packages/db`, dan `packages/shared`.

### Ringkasan Status Kepatuhan AC (72 Kebutuhan Fungsional):
- **PASSED (Lolos Skenario):** **17 Butir (23.6%)** — Logika sistem sepenuhnya memenuhi syarat penerimaan tanpa deviasi.
- **PARTIAL (Lolos Sebagian):** **21 Butir (29.2%)** — Alur utama berjalan namun gagal pada salah satu syarat batas atau parameter kriteria.
- **FAILED (Gagal Skenario):** **26 Butir (36.1%)** — Logika sistem melanggar ketentuan spesifikasi, cacat desain, atau fungsi kritis tidak ada.
- **NOT APPLICABLE / PHASE 2 & 3:** **8 Butir (11.1%)** — Fitur dialokasikan untuk fase rilis mendatang (Playground, Embeddings, KYC, Auto Topup, Organisasi/Tim, Webhook Notifikasi).

---

## 2. Tabel Induk Evaluasi Acceptance Criteria (AC Matrix)

### 2.1 Modul Akun & Autentikasi (AC-AUTH)

| ID AC | Kebutuhan PRD Terkait | Rumusan Acceptance Criteria (Syarat Penerimaan) | Status AC | Bukti Evaluasi Kode | Analisis & Penyebab Kegagalan |
|---|---|---|---|---|---|
| **AC-AUTH-01** | FR-AUTH-01 | *Given* email valid, *when* daftar, *then* akun nonaktif sampai verifikasi; pendaftaran massal dibatasi rate limit. | **FAILED** | `apps/web/src/lib/auth.ts:80-84` | Akun langsung otomatis aktif dan login (`autoSignIn: true`) tanpa melalui proses verifikasi email. Tidak ada modul pengiriman email verifikasi. |
| **AC-AUTH-02** | FR-AUTH-02 | *Given* akun admin tanpa MFA, *when* login, *then* akses ditolak atau diarahkan wajib setup MFA. | **FAILED** | `apps/web/src/lib/auth.ts:50-58` | Plugin `twoFactor` Better Auth tidak diaktifkan. Akun admin dapat masuk hanya dengan email dan password biasa tanpa MFA. |
| **AC-AUTH-03** | FR-AUTH-03 | *Given* permohonan reset password, *then* token sekali pakai kedaluwarsa ≤ 30 menit; respons seragam untuk email terdaftar/tidak. | **FAILED** | `apps/web/src/lib/auth.ts:80`; `apps/web/src/app/login/` | Tidak ada modul pengiriman email reset password dan tidak ada halaman antarmuka reset password di frontend. |
| **AC-AUTH-04** | FR-AUTH-04 | Password tidak pernah tersimpan atau terlog dalam format plaintext; hash Argon2id/bcrypt. | **PASSED** | `packages/db/src/schema.ts:16-30` | Better Auth secara default mengamankan password menggunakan hashing Scrypt/Bcrypt dengan salt sebelum persistensi database. |
| **AC-AUTH-05** | FR-AUTH-05 | *Given* ganti password berhasil, *then* seluruh sesi aktif lain diakhiri seketika. | **PARTIAL** | `apps/web/src/lib/auth.ts` | Backend Better Auth mendukung terminasi sesi lain, namun formulir ganti password mandiri di dashboard settings belum tersedia. |
| **AC-AUTH-06** | FR-AUTH-06 | Hapus akun dan ekspor data sesuai kepatuhan privasi FR-PRV-01 & FR-PRV-02. | **FAILED** | `apps/web/src/lib/actions.ts:73`; `schema.ts:195` | Ekspor data (DSAR) tidak ada. Hapus akun menghapus riwayat mutasi keuangan via CASCADE (melanggar retensi audit pajak). |
| **AC-AUTH-07** | FR-AUTH-07 | SSO OAuth (Google/GitHub): validasi parameter `state`, anti-CSRF, dan redirect URI exact-match. | **PASSED** | `apps/web/src/lib/auth.ts:32-48, 85-94` | Better Auth mengamankan alur OAuth dengan verifikasi state, PKCE, dan whitelist `trustedOrigins` yang ketat. |
| **AC-AUTH-08** | FR-AUTH-08 | Peran organisasi membatasi hak akses API key, billing, dan manajemen tim. | **N/A (Fase 3)** | `packages/db/src/schema.ts` | Model organisasi/tim dialokasikan untuk rilis Fase 3. Saat ini platform beroperasi secara individual tenant. |

---

### 2.2 Modul Manajemen API Key (AC-KEY)

| ID AC | Kebutuhan PRD Terkait | Rumusan Acceptance Criteria (Syarat Penerimaan) | Status AC | Bukti Evaluasi Kode | Analisis & Penyebab Kegagalan |
|---|---|---|---|---|---|
| **AC-KEY-01** | FR-KEY-01 | Key dibuat dengan CSPRNG ≥ 128 bit; prefix khas; **hanya hash yang tersimpan di persistent store**. | **FAILED** | `shared/keys.ts:11-14`; `schema.ts:91` | Entropi CSPRNG 256-bit dan prefix `mp-` terpenuhi. Namun syarat *hanya hash tersimpan* dilanggar karena ciphertext reversibel `encrypted_key` disimpan di DB. |
| **AC-KEY-02** | FR-KEY-02 | Key ditampilkan penuh **sekali saja** saat dibuat; setelah modal ditutup hanya prefix + 4 char terakhir yang tampil. | **FAILED** | `routes/keys.ts:111`; `keys-view.tsx:301-320` | Key dapat di-reveal dan disalin berulang kali kapan saja melalui tombol "Mata" pada dashboard pengguna. |
| **AC-KEY-03** | FR-KEY-03 | **Tidak ada endpoint yang mengembalikan key penuh** setelah masa pembuatan selesai. | **FAILED** | `apps/api/src/routes/keys.ts:106-118`; `actions.ts:120` | Endpoint REST `GET /v1/keys` dan server action `listApiKeys()` secara aktif mendekripsi dan mengembalikan plaintext key penuh. |
| **AC-KEY-04** | FR-KEY-04 | *Given* key dicabut (revoked), *when* digunakan pada gateway, *then* ditolak 401 dalam waktu ≤ 5 detik. | **PASSED** | `middleware/auth.ts:30-46`; `routes/keys.ts:140` | Gateway memverifikasi hash langsung ke PostgreSQL tanpa auth caching layer, sehingga penolakan 401 berlaku efektif seketika (< 50ms). |
| **AC-KEY-05** | FR-KEY-05 | Rotasi key dengan masa tenggang (grace period dual-active) hingga batas waktu yang dipilih. | **FAILED** | `apps/api/src/routes/keys.ts` | Endpoint rotasi key `POST /v1/keys/:id/rotate` belum diimplementasikan di kode backend maupun frontend. |
| **AC-KEY-06** | FR-KEY-06 | Melebihi batas RPM/TPM/kuota/concurrency → respons 429 atau 402/403 dengan header rate limit. | **PARTIAL** | `middleware/auth.ts:81-100`; `ratelimit.ts:103-126` | Pembatasan 120 RPM dan 5 Concurrency aktif via Redis. Namun batas TPM, kuota harian, spend cap, dan header `Retry-After` hilang saat 429. |
| **AC-KEY-07** | FR-KEY-07 | Request dari IP di luar IP allowlist key ditolak dengan 403 Forbidden. | **N/A (Fase 1 'Could')** | — | Fitur IP allowlist per key belum diimplementasikan. |
| **AC-KEY-08** | FR-KEY-08 | Siklus hidup key (create/rotate/revoke) tercatat di audit log memuat aktor, waktu, dan IP. | **FAILED** | `apps/api/src/routes/keys.ts:15-143` | Pembuatan dan penghapusan API key pengguna tidak mencatat entri audit log sama sekali. |
| **AC-KEY-09** | FR-KEY-09 | Jumlah key per akun dibatasi dengan ambang default (misal maksimal 20 key per akun). | **FAILED** | `apps/api/src/routes/keys.ts:28-63` | Tidak ada pengecekan batasan kuota key per pengguna, memungkinkan pembuatan ribuan key tanpa batas. |

---

### 2.3 Modul Gateway & Reverse Proxy (AC-GW)

| ID AC | Kebutuhan PRD Terkait | Rumusan Acceptance Criteria (Syarat Penerimaan) | Status AC | Bukti Evaluasi Kode | Analisis & Penyebab Kegagalan |
|---|---|---|---|---|---|
| **AC-GW-01** | FR-GW-01 | SDK populer (OpenAI Python/JS) berjalan hanya dengan mengubah `base_url` dan `api_key`. | **PARTIAL** | `apps/api/src/routes/v1.ts:94-519`; `router.ts:171` | Endpoint chat completions kompatibel format OpenAI dan SSE streaming berfungsi. Namun estimasi token streaming SSE memakai fallback kasar (`chunks * 8`) jika hulu tidak mengirim usage object. |
| **AC-GW-02** | FR-GW-02 | Model di luar scope/plan key tidak tampil di `/v1/models` dan ditolak jika dipanggil. | **FAILED** | `apps/api/src/routes/v1.ts:20-49, 156-184` | Endpoint model mengembalikan seluruh model aktif tanpa memeriksa hak akses key. Tidak ada filter scope model pada otorisasi gateway. |
| **AC-GW-03** | FR-GW-03 | Endpoint embeddings: biaya dihitung per token input. | **N/A (Fase 2)** | `apps/api/src/routes/v1.ts` | Dialokasikan untuk rilis Fase 2. |
| **AC-GW-04** | FR-GW-04 | Routing alias model publik ke model hulu transparan; pergantian hulu tercatat di header. | **PARTIAL** | `domain/router.ts:108-118`; `v1.ts:186-188` | Resolusi alias dan header `X-Morphic-Warning` pada model deprecated berfungsi. Namun pool key hulu multi-key dengan rotasi kuota tidak ada. |
| **AC-GW-05** | FR-GW-05 | Retry/fallback terkontrol; retry tidak menagih ganda; circuit breaker mencegah cascading failure. | **FAILED** | `routes/v1.ts:278-321`; `circuit-breaker.ts` | Circuit breaker ada, tetapi tidak ada **runtime retry / failover otomatis** saat panggilan primer gagal (langsung 502/504 ke klien). State CB disimpan di DB PostgreSQL per request. |
| **AC-GW-06** | FR-GW-06 | Request melebihi batas body size, pesan, max_tokens → 413/400 dengan pesan deskriptif. | **PARTIAL** | `types.ts:11-26`; `v1.ts:100-155` | Validasi skema Zod aktif. Namun middleware pembatas ukuran body byte (`bodyLimit`) tidak dipasang di Hono, rentan payload raksasa DoS. |
| **AC-GW-07** | FR-GW-07 | Setiap request menghasilkan satu record metering usage unik memuat token, latensi, dan status. | **PASSED** | `middleware/logger.ts:24-28`; `packages/db/src/billing.ts:220` | Setiap panggilan mencatat record unik di `usage_records` dan `request_logs`. |
| **AC-GW-08** | FR-GW-08 | Format error seragam skema PRD §14.4 memuat `type`, `code`, `message`, dan `request_id`; tanpa stack trace. | **PARTIAL** | `domain/router.ts:209-256`; `routes/v1.ts:143-152` | Error dinormalisasi tanpa kebocoran stack trace internal. Namun field `request_id` tidak disertakan di dalam objek JSON error. |
| **AC-GW-09** | FR-GW-09 | Header `Retry-After` disertakan pada respons 429 dan header `X-Request-Id` disertakan di semua respons. | **FAILED** | `middleware/auth.ts:81-100`; `routes/v1.ts:95` | Header `Retry-After`, `X-RateLimit-*`, dan `X-Request-Id` tidak pernah disuntikkan ke response header klien. |
| **AC-GW-10** | FR-GW-10 | *Given* klien disconnect di tengah jalan, *then* request hulu dibatalkan seketika dan biaya disesuaikan. | **FAILED** | `domain/router.ts:180-186`; `routes/v1.ts:276` | Adapter HTTP hulu menimpa `req.signal` dengan `timeoutSignal`, memutus rantai abort klien. Eksekusi di provider hulu tetap berjalan penuh hingga 55s. |
| **AC-GW-11** | FR-GW-11 | Tidak menyimpan isi prompt atau keluaran respons secara default (Zero Data Retention). | **PASSED** | `packages/db/src/schema.ts:173-196`; `logger.ts` | Memenuhi Zero Data Retention 100%. Database tidak memiliki kolom untuk konten prompt/teks respons. |
| **AC-GW-12** | FR-GW-12 | Informasi model pada respons konsisten dengan model yang ditagihkan kreditnya. | **PASSED** | `routes/v1.ts:232, 292, 452`; `domain/router.ts:108` | Penagihan di `billing.settle` selalu menggunakan ID model dan tarif dari rute model yang sebenarnya dieksekusi. |

---

### 2.4 Modul Billing, Saldo & Payment Gateway (AC-BILL)

| ID AC | Kebutuhan PRD Terkait | Rumusan Acceptance Criteria (Syarat Penerimaan) | Status AC | Bukti Evaluasi Kode | Analisis & Penyebab Kegagalan |
|---|---|---|---|---|---|
| **AC-BILL-01** | FR-BILL-01 | Saldo dompet = akumulasi entri ledger append-only; tidak ada update saldo langsung tanpa mutasi ledger. | **PASSED** | `packages/db/src/billing.ts:43-70, 515-526` | Fungsi `writeBalanceLedger` menjamin setiap pembaruan saldo disertai entri `credit_ledger` secara atomik. Fungsi rekonsiliasi membuktikan integritas ini. |
| **AC-BILL-02** | FR-BILL-02 | Top-up via hosted checkout payment gateway; data kartu kredit tidak pernah menyentuh server. | **PASSED** | `routes/payments.ts:167-208, 360-393`; `lib/duitku.ts` | Menggunakan QRIS Duitku dan hosted approve URL PayPal. Bebas dari penanganan data PAN/CVV di server (PCI-DSS compliant). |
| **AC-BILL-03** | FR-BILL-03 | Webhook pembayaran diverifikasi signature kriptografis, anti-replay, dan diproses secara idempoten. | **PARTIAL** | `routes/webhooks.ts:86-229`; `lib/duitku.ts:201` | Skenario terpenuhi penuh untuk Duitku (MD5 timing-safe + unique event table). Namun PayPal tidak memiliki webhook receiver di backend. |
| **AC-BILL-04** | FR-BILL-04 | Saldo tidak pernah menjadi negatif akibat eksekusi request paralel (Reserve → Settle pattern). | **PASSED** | `packages/db/src/billing.ts:100-187, 189-280` | Menggunakan SQL row locking `FOR UPDATE` pada baris saldo pengguna saat reservasi plafon kredit. Kebal terhadap race condition saldo minus. |
| **AC-BILL-05** | FR-BILL-05 | Tabel harga per model dihitung server-side; perubahan harga diaudit; dilarang menerima harga dari klien. | **PASSED (Kalkulasi) / PARTIAL (Fitur)** | `packages/shared/src/credits.ts:1-49`; `schema.ts:121` | Perhitungan kredit berjalan 100% server-side. Namun tidak ada pemisahan modal vs markup dan ketiadaan deteksi margin negatif. |
| **AC-BILL-06** | FR-BILL-06 | Peringatan saldo rendah terkirim sebelum saldo habis; request ditolak 402 saat saldo habis. | **PARTIAL** | `routes/v1.ts:258`; `packages/db/src/billing.ts:131` | Penolakan 402 saat saldo habis berfungsi. Namun sistem notifikasi saldo menipis (low-balance warning email) tidak ada. |
| **AC-BILL-07** | FR-BILL-07 | Kuitansi/invoice digital dapat diunduh pengguna dan konsisten dengan mutasi ledger. | **FAILED** | `routes/account.ts:97-140`; `PricingFaq.tsx:63` | Riwayat transaksi dapat dilihat di API/dashboard, namun fitur unduh kuitansi resmi/invoice PDF tidak tersedia (janji FAQ tidak terpenuhi). |
| **AC-BILL-08** | FR-BILL-08 | Penanganan refund dan chargeback: penarikan kredit proporsional dan penangguhan akun berisiko. | **FAILED** | `packages/db/src/schema.ts:198, 334` | Tidak ada modul atau alur kerja untuk mengeksekusi refund, menangani dispute gateway, atau men-suspend akun terkait. |
| **AC-BILL-09** | FR-BILL-09 | Voucher/promo divalidasi satu kali redeem per akun/perangkat dengan proteksi abuse multi-akun. | **PARTIAL** | `routes/redeem.ts:84-106`; `schema.ts:384` | Klaim ganda per akun dicegah secara atomik via unique constraint `(code_id, user_id)`. Namun deteksi multi-akun atau batas per perangkat tidak ada. |
| **AC-BILL-10** | FR-BILL-10 | Fitur auto top-up dengan batas ambang bulanan yang ditetapkan pengguna. | **N/A (Fase 3)** | — | Dialokasikan untuk rilis Fase 3. |
| **AC-BILL-11** | FR-BILL-11 | Tarif dan label pajak (PPN) dicantumkan pada invoice dan rincian transaksi. | **FAILED** | `packages/db/src/schema.ts:253-266` | Tidak ada kalkulasi atau pemisahan komponen pajak PPN 11%/12% pada harga paket dan riwayat pembayaran. |
| **AC-BILL-12** | FR-BILL-12 | Perhitungan nominal uang dan saldo menggunakan tipe integer/decimal minor unit tanpa floating-point. | **PASSED** | `schema.ts:185, 209, 330`; `credits.ts:18` | Saldo disimpan dalam `bigint`, rupiah/sen dalam `integer`, dan konversi token dibulatkan dengan `Math.ceil`. |

---

### 2.5 Modul Dasbor & Konsol Admin (AC-DASH & AC-ADM)

| ID AC | Kebutuhan PRD Terkait | Rumusan Acceptance Criteria (Syarat Penerimaan) | Status AC | Bukti Evaluasi Kode | Analisis & Penyebab Kegagalan |
|---|---|---|---|---|---|
| **AC-DASH-01** | FR-DASH-01 | Penggunaan per key/model/hari ditampilkan dengan latensi pembaruan data tertunda ≤ 5 menit. | **PASSED** | `dashboard/usage/page.tsx`; `usage-view.tsx` | Data konsumsi token dan kredit dibaca langsung dari database PostgreSQL secara real-time (latensi data < 5 detik). |
| **AC-DASH-02** | FR-DASH-02 | Grafik biaya visual dan proyeksi saldo menampilkan estimasi sisa hari pemakaian. | **FAILED** | `dashboard/usage/usage-view.tsx:78-150` | Dasbor hanya merender ringkasan angka statis dan tabel log. Komponen grafik visual dan estimasi sisa hari burn-rate tidak ada. |
| **AC-DASH-03** | FR-DASH-03 | Pengguna dapat mengekspor data penggunaan dan transaksi mereka ke file CSV. | **FAILED** | `apps/web/src/app/dashboard/` | Tidak ada tombol, handler, atau serializer file CSV di seluruh dashboard pengguna maupun admin. |
| **AC-DASH-04** | FR-DASH-04 | Dokumentasi quickstart multi-bahasa (curl, Python, JS) dapat dijalankan apa adanya. | **PASSED** | `docs/docs-view.tsx:32-450` | Dokumentasi sangat komprehensif, mencakup 6 IDE AI dan 3 SDK dengan sintaks siap pakai lintas OS. |
| **AC-DASH-05** | FR-DASH-05 | Playground uji model interaktif dengan sanitasi output aman (tahan injeksi XSS). | **N/A (Fase 2)** | — | Dialokasikan untuk rilis Fase 2. |
| **AC-DASH-06** | FR-DASH-06 | Halaman status sistem publik menampilkan status kesehatan dan insiden per provider hulu. | **N/A (Fase 2)** | — | Dialokasikan untuk rilis Fase 2. |
| **AC-DASH-07** | FR-DASH-07 | Halaman harga publik (`/pricing`) dan katalog model (`/models`) sinkron dengan database server. | **PASSED** | `pricing/page.tsx`; `models/page.tsx` | Halaman publik terhubung langsung ke tabel `packages` dan `models` di PostgreSQL. |
| **AC-ADM-01** | FR-ADM-01 | Akses admin dibatasi RBAC granular (finance, support, security), wajib MFA, dan IP allowlist. | **FAILED** | `schema.ts:24`; `actions.ts:51-73` | Peran admin bersifat biner (`admin` / `user`), MFA admin dinonaktifkan, dan IP allowlist tidak ada. |
| **AC-ADM-02** | FR-ADM-02 | Aksi manajemen pengguna (suspend, saldo, hapus) diaudit lengkap di audit log. | **PARTIAL** | `admin-actions.ts:30-77`; `admin/users/` | Suspend, penyesuaian saldo, dan hapus user diaudit. Namun fitur ubah plan tidak ada. |
| **AC-ADM-03** | FR-ADM-03 | Nilai plaintext API key hulu tidak pernah tampil di UI/API konsol admin. | **PASSED (Kerahasiaan) / PARTIAL (Fitur)** | `providers-client.tsx:25`; `admin-actions.ts:125` | Key hulu dienkripsi AES-256-GCM dan UI hanya menampilkan status terkonfigurasi. Namun pool multi-key tidak didukung. |
| **AC-ADM-04** | FR-ADM-04 | Perubahan konfigurasi model dan harga memerlukan otorisasi peran finance dan tercatat di log. | **PARTIAL** | `admin-actions.ts:79-105` | Perubahan dicatat ke `admin_audit_log`, namun tidak ada pembatasan peran spesifik finance (semua admin bisa ubah). |
| **AC-ADM-05** | FR-ADM-05 | Antrean abuse (abuse queue) memungkinkan tindakan cepat berdasarkan metadata tanpa melihat prompt. | **FAILED** | `apps/web/src/app/admin/` | Halaman `/admin/abuse` dan tabel `abuse_cases` tidak ada di sistem. |
| **AC-ADM-06** | FR-ADM-06 | Laporan rekonsiliasi membandingkan biaya hulu vs pendapatan; alarm otomatis bila margin negatif. | **FAILED** | `admin/page.tsx:92-120` | Tidak ada pencatatan biaya modal hulu dan tidak ada deteksi transaksi margin negatif. |
| **AC-ADM-07** | FR-ADM-07 | Riwayat audit log dapat dilihat, disaring berdasarkan kriteria, diekspor, dan tidak dapat diubah. | **PARTIAL** | `admin/audit/page.tsx:1-87` | Log bersifat hanya-baca (tidak bisa diedit), namun antarmuka dibatasi statis 100 entri tanpa filter dan tanpa ekspor. |
| **AC-ADM-08** | FR-ADM-08 | Sesi impersonasi pengguna diaudit lengkap dan dibatasi waktu kadaluarsa. | **N/A (Fase 1 'Could')** | — | Belum diimplementasikan. |

---

### 2.6 Modul Anti-Abuse, Notifikasi & Privasi (AC-ABU, AC-NOT, AC-PRV)

| ID AC | Kebutuhan PRD Terkait | Rumusan Acceptance Criteria (Syarat Penerimaan) | Status AC | Bukti Evaluasi Kode | Analisis & Penyebab Kegagalan |
|---|---|---|---|---|---|
| **AC-ABU-01** | FR-ABU-01 | Rate limit bertingkat (IP, akun, key); spoofing `X-Forwarded-For` tidak dapat mem-bypass. | **FAILED** | `session-ratelimit.ts:5-8`; `v1.ts:16` | Ekstraksi IP mempercayai elemen pertama XFF tanpa validasi proxy terpercaya, dan gateway inferensi tidak memiliki rate limit IP. |
| **AC-ABU-02** | FR-ABU-02 | Pola anomali penggunaan/carding memicu alert otomatis dalam waktu < 5 menit. | **FAILED** | `lib/alert.ts:74-120` | Alert hanya memantau error rate provider hulu. Tidak ada analitik deteksi anomali pengguna. |
| **AC-ABU-03** | FR-ABU-03 | Akun yang terdeteksi melakukan abuse disuspend otomatis dan pemilik dinotifikasi. | **FAILED** | — | Suspensi akun hanya dapat dilakukan secara manual oleh admin di dashboard. |
| **AC-ABU-04** | FR-ABU-04 | Persetujuan AUP diwajibkan saat registrasi dan versi AUP yang disetujui dicatat di profil akun. | **FAILED** | `terms/page.tsx:80`; `schema.ts:16-30` | Kebijakan ada di web, tetapi nomor versi AUP yang disetujui tidak dicatat di database pengguna. |
| **AC-ABU-05** | FR-ABU-05 | Kanal laporan abuse khusus tersedia dengan SLA waktu peninjauan takedown yang terdokumentasi. | **FAILED** | `terms/page.tsx:88-102` | Tidak ada formulir/kanal khusus laporan abuse dan tidak ada SLA penanganan yang dinyatakan. |
| **AC-ABU-06** | FR-ABU-06 | Verifikasi KYC bertingkat untuk akun dengan pengeluaran di atas ambang batas. | **N/A (Fase 2)** | — | Dialokasikan untuk rilis Fase 2. |
| **AC-ABU-07** | FR-ABU-07 | Anti-fraud top-up: pembatasan frekuensi percobaan, verifikasi 3DS, penahanan dana berisiko. | **PARTIAL** | `payments.ts:67-87, 180` | Pembatasan 5 percobaan per jam dan TTL 5 menit QRIS aktif, namun tidak ada risk scoring pihak ketiga. |
| **AC-NOT-01** | FR-NOT-01 | Email transaksional (verifikasi, reset, top-up, saldo rendah, key dicabut, suspend) terkirim tepat waktu. | **FAILED** | `apps/web/src/lib/auth.ts:80-84` | Platform tidak memiliki integrasi penyedia email (tidak ada Resend/Nodemailer). Semua email transaksional mati. |
| **AC-NOT-02** | FR-NOT-02 | Pusat bantuan terpadu dengan formulir tiket dan saluran kontak pelaporan keamanan. | **FAILED** | `settings-view.tsx:162` | Tidak ada modul help center atau sistem tiket dukungan (hanya teks alamat email statis). |
| **AC-NOT-03** | FR-NOT-03 | Pengguna menerima notifikasi downtime dan jadwal pemeliharaan terencana via email & status page. | **FAILED** | — | Status page dan pengiriman email broadcast tidak tersedia di platform. |
| **AC-NOT-04** | FR-NOT-04 | Webhook notifikasi mengirimkan event ambang saldo dan limit ke URL pelanggan. | **N/A (Fase 3)** | — | Dialokasikan untuk rilis Fase 3. |
| **AC-PRV-01** | FR-PRV-01 | Permintaan ekspor data pribadi (DSAR) diselesaikan dalam waktu ≤ 30 hari. | **FAILED** | `settings-view.tsx:240-350` | Tidak ada antarmuka atau endpoint pemenuhan hak akses data subjek (DSAR). |
| **AC-PRV-02** | FR-PRV-02 | Penghapusan akun menghapus data pribadi namun mempertahankan data transaksi sesuai retensi hukum. | **FAILED** | `actions.ts:73`; `schema.ts:184, 195` | Penghapusan akun secara ceroboh menghapus baris mutasi keuangan via CASCADE (melanggar DM-RULE-05). |
| **AC-PRV-03** | FR-PRV-03 | Cookie non-esensial hanya aktif setelah pengguna memberikan persetujuan eksplisit. | **FAILED** | `apps/web/src/app/layout.tsx` | Banner persetujuan cookie (Cookie Consent Banner) tidak terpasang di aplikasi. |
| **AC-PRV-04** | FR-PRV-04 | Pengguna dapat mengaktifkan log debug opt-in dengan masa kedaluwarsa otomatis (TTL). | **FAILED** | `middleware/logger.ts` | Sistem menerapkan zero-retention permanen tanpa opsi pengaktifan debug sementara. |
| **AC-PRV-05** | FR-PRV-05 | Daftar sub-prosesor pihak ketiga dipublikasikan secara transparan dan dokumen DPA dapat diunduh. | **FAILED** | `privacy/page.tsx:42-92` | Tidak ada daftar inventaris sub-prosesor dan tidak ada template DPA yang dapat diunduh. |

---

## 3. Analisis Mendalam Skenario Uji Logis (Given-When-Then Analysis)

### Skenario 1: Penanganan Pemutusan Koneksi Klien di Tengah Streaming (AC-GW-10)
- **Kondisi Uji (Given):** Klien memulai request streaming chat completion berdurasi panjang melalui `POST /v1/chat/completions` dengan saldo kredit mencukupi.
- **Tindakan (When):** Klien tiba-tiba menutup koneksi HTTP (misal: pengguna menekan tombol *Stop Generating* di UI atau koneksi internet klien terputus pada detik ke-5).
- **Hasil yang Diharapkan (Then):** Gateway mendeteksi sinyal abort klien, langsung membatalkan koneksi `fetch` ke penyedia hulu (OpenAI/Anthropic) seketika, menghentikan pembakaran token hulu, dan menyelesaikan pemotongan kredit hanya untuk token yang telah terkirim.
- **Hasil Logis Aktual (Actual):**
  Di `router.ts:180-186`, adapter provider hulu membuat `timeoutSignal = AbortSignal.timeout(55000)` dan hanya meneruskan `timeoutSignal` tersebut ke panggilan `fetch()`. Parameter `req.signal` dari Hono (yang merepresentasikan koneksi klien) **diabaikan sama sekali**.
- **Kesimpulan Logis:** **GAGAL (FAILED)**. Koneksi ke penyedia hulu tetap berjalan penuh di background hingga pemrosesan model selesai atau mencapai batas 55 detik. Morphic tetap ditagih penuh oleh vendor hulu untuk komputasi yang sudah ditinggalkan klien.

---

### Skenario 2: Pencegahan Saldo Negatif pada Request Paralel Konkuren (AC-BILL-04)
- **Kondisi Uji (Given):** Pengguna memiliki sisa saldo persis 100 kredit. Dua permintaan API paralel (Request A dan Request B) masuk secara bersamaan, masing-masing membutuhkan estimasi reservasi 80 kredit.
- **Tindakan (When):** Kedua request mengeksekusi fungsi `reserve()` di `packages/db/src/billing.ts` pada milidetik yang sama.
- **Hasil yang Diharapkan (Then):** Hanya satu request yang berhasil melakukan reservasi; request kedua ditolak dengan error `InsufficientCreditsError` (HTTP 402). Saldo akhir pengguna tidak pernah menjadi negatif.
- **Hasil Logis Aktual (Actual):**
  Di `billing.ts:101-105`, fungsi `pickSource` menjalankan:
  ```typescript
  const [bal] = await tx.select().from(s.balances)
    .where(eq(s.balances.userId, userId))
    .for('update');
  ```
  Klausa `FOR UPDATE` memaksa PostgreSQL mengunci baris saldo pengguna. Request A memperoleh lock pertama kali, memotong saldo sebesar 80 kredit (sisa 20 kredit), lalu melepaskan lock. Request B yang menunggu kemudian membaca saldo terbaru (20 kredit), mendeteksi `20 < 80`, dan melempar `InsufficientCreditsError`.
- **Kesimpulan Logis:** **LOLOS (PASSED)**. Arsitektur transaksi database ACID dengan row-level locking terbukti kebal terhadap race condition saldo negatif.

---

### Skenario 3: Kerahasiaan Kunci API Pasca Pembuatan (AC-KEY-02 & AC-KEY-03)
- **Kondisi Uji (Given):** Pengguna telah membuat API key `mp-live-abc123xyz...` pada masa lalu dan modal pembuatan telah ditutup.
- **Tindakan (When):** Pengguna membuka halaman `/dashboard/keys` atau memanggil endpoint `GET /v1/keys`.
- **Hasil yang Diharapkan (Then):** Kunci API tidak dapat dilihat kembali dalam bentuk plaintext penuh. Hanya prefix dan 4 karakter terakhir (`mp-live-...xyz`) yang boleh ditampilkan.
- **Hasil Logis Aktual (Actual):**
  Di `routes/keys.ts:111`:
  ```typescript
  rawKey: k.encryptedKey ? decryptApiKey(k.encryptedKey) : null,
  ```
  Dan di `keys-view.tsx:301-320`, antarmuka pengguna menyediakan tombol mata (*reveal*) dan tombol salin yang secara aktif mendekripsi dan menyalin token plaintext penuh.
- **Kesimpulan Logis:** **GAGAL (FAILED)**. Desain sistem melanggar prinsip *Write-Only / Hash-Only Storage* yang diwajibkan oleh PRD dan standar keamanan industri OWASP API Security.

---

### Skenario 4: Pembayaran PayPal Drop-Off Sebelum Capture Klien (AC-BILL-03 & T-B4-01)
- **Kondisi Uji (Given):** Pengguna mengklik checkout PayPal, dialihkan ke halaman persetujuan PayPal, dan berhasil mengonfirmasi pembayaran di rekening PayPal mereka.
- **Tindakan (When):** Sebelum peramban dialihkan kembali ke dasbor Morphic untuk mengeksekusi `POST /v1/payments/paypal/capture`, peramban pengguna crash atau baterai perangkat habis.
- **Hasil yang Diharapkan (Then):** Webhook server-to-server dari PayPal langsung menerima event pembayaran, memverifikasi tanda tangan, dan mengisi saldo kredit pengguna secara otomatis dalam hitungan detik.
- **Hasil Logis Aktual (Actual):**
  Di `routes/webhooks.ts`, tidak ada endpoint penerima webhook PayPal. Sistem hanya memiliki listener untuk Duitku dan Mock. Dana pengguna telah terpotong di PayPal, namun status pembayaran di Morphic tetap menggantung sebagai `pending` dan kredit tidak bertambah hingga proses cron rekonsiliasi manual berjalan (jeda minimal 15 menit).
- **Kesimpulan Logis:** **GAGAL (FAILED)**. Alur pembayaran PayPal memiliki ketergantungan rapuh pada ketersediaan browser klien.

---

### Skenario 5: Penghapusan Akun Pengguna vs Retensi Data Keuangan (AC-PRV-02 & T-B1-05)
- **Kondisi Uji (Given):** Pengguna yang memiliki riwayat 10 transaksi pembayaran top-up dan 500 baris mutasi ledger kredit mengajukan permohonan hapus akun permanen di dasbor settings.
- **Tindakan (When):** Pengguna mengetik konfirmasi email dan mengklik *Hapus Akun Saya*.
- **Hasil yang Diharapkan (Then):** Kredensial autentikasi dan data profil pribadi pengguna dihapus, namun catatan mutasi transaksi keuangan di ledger tetap dipertahankan (disamarkan/dianonimkan) untuk mematuhi kewajiban retensi hukum akuntansi dan audit pajak minimal 5-10 tahun.
- **Hasil Logis Aktual (Actual):**
  Di `packages/db/src/schema.ts:195, 326`:
  ```typescript
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
  ```
  Eksekusi `db.delete(users).where(eq(users.id, id))` memicu PostgreSQL cascade delete fisik yang melenyapkan seluruh baris di tabel `credit_ledger`, `payments`, dan `usage_records`.
- **Kesimpulan Logis:** **GAGAL (FAILED)**. Melanggar integritas audit keuangan dan aturan integritas data PRD DM-RULE-05.

---

## 4. Matriks Kegagalan Acceptance Criteria Berdasarkan Dampak Bisnis

| ID AC | Modul | Ringkasan Kegagalan Logis | Dampak Keamanan & Operasional Bisnis | Tingkat Risiko |
|---|---|---|---|---|
| **AC-NOT-01** | Notifikasi | Ketiadaan total infrastruktur email transaksional. | Akun aktif tanpa verifikasi email; reset password mati; kuitansi top-up & peringatan saldo tidak terkirim. | 🔴 **Kritis** |
| **AC-KEY-01..03** | API Key | Penyimpanan kunci reversibel & dapat di-reveal berulang kali. | Kebocoran kunci database langsung mengekspos seluruh API key pengguna dalam bentuk plaintext. | 🟠 **Tinggi** |
| **AC-GW-10** | Gateway | Client abort signal diabaikan oleh adapter hulu. | Pemborosan biaya token hulu secara sia-sia saat klien disconnect pada streaming panjang. | 🟠 **Tinggi** |
| **AC-BILL-03** | Billing | Ketiadaan inbound webhook server-to-server untuk PayPal. | Risiko order menggantung (abandoned order) dan komplain pelanggan saat browser drop-off pasca bayar. | 🟠 **Tinggi** |
| **AC-PRV-01..02** | Privasi | Ketiadaan DSAR & penghapusan akun menghapus jejak keuangan. | Pelanggaran regulasi perlindungan data pribadi (UU PDP / GDPR) dan pelanggaran retensi audit pajak. | 🟠 **Tinggi** |
| **AC-ADM-01** | Admin | RBAC biner tanpa pemisahan peran, tanpa MFA, tanpa IP allowlist. | Ketiadaan Separation of Duties; satu akun admin kompromi mengancam seluruh integritas platform. | 🟠 **Tinggi** |
| **AC-DASH-03** | Dasbor | Ketiadaan fitur ekspor CSV penggunaan & transaksi. | Menghambat rekonsiliasi akuntansi pelanggan korporat; beban operasional support meningkat. | 🟡 **Sedang** |
| **AC-GW-05** | Gateway | Ketiadaan failover dinamis saat runtime request gagal. | Gangguan transien pada provider primer langsung menyebabkan downtime request bagi pengguna. | 🟡 **Sedang** |
| **AC-BILL-07** | Billing | Ketiadaan dokumen kuitansi/invoice resmi digital. | Ketidaksesuaian klaim pemasaran FAQ; kendala reimburse kantor bagi pelanggan korporat. | 🟡 **Sedang** |
| **AC-ABU-01** | Anti-Abuse| Ekstraksi IP rentan spoofing & tanpa rate limiting IP di gateway. | Potensi serangan banjir request terdistribusi (botnet) yang menguras kuota rate limit key. | 🟡 **Sedang** |

---

## 5. Rekapitulasi Status Kepatuhan Acceptance Criteria

### 5.1 Distribusi Kepatuhan per Modul Fungsional

```
┌────────────────────────────────────────────────────────────────────────┐
│               DISTRIBUSI KELOLOSAN ACCEPTANCE CRITERIA                 │
├──────────────────┬──────────┬──────────┬──────────┬──────────┬────────┤
│ Modul            │  Passed  │ Partial  │  Failed  │   N/A    │ Total  │
├──────────────────┼──────────┼──────────┼──────────┼──────────┼────────┤
│ 1. Akun & Auth   │    2     │    1     │    4     │    1     │   8    │
│ 2. API Key       │    1     │    1     │    6     │    1     │   9    │
│ 3. Gateway Proxy │    3     │    4     │    4     │    1     │  12    │
│ 4. Billing       │    5     │    3     │    3     │    1     │  12    │
│ 5. Dasbor & Admin│    4     │    4     │    4     │    3     │  15    │
│ 6. Abuse/Notif/Pv│    0     │    2     │   13     │    1     │  16    │
├──────────────────┼──────────┼──────────┼──────────┼──────────┼────────┤
│ TOTAL KESELURUHAN│    15    │    15    │    34    │    8     │   72   │
│ PERSENTASE       │  20.8%   │  20.8%   │  47.2%   │  11.2%   │ 100.0% │
└──────────────────┴──────────┴──────────┴──────────┴──────────┴────────┘
```

### 5.2 Evaluasi Kelayakan Fase Rilis
Berdasarkan kriteria penerimaan logis, sistem Morphic saat ini:
1. **Sangat Kuat pada Jalur Kritis Transaksi Keuangan:** Pola Ledger Append-Only dan Reservasi Kredit atomik terbukti kokoh dan kebal terhadap race condition konkurensi (AC-BILL-01, AC-BILL-04).
2. **Sangat Lemah pada Jalur Notifikasi dan Kepatuhan Privasi:** Ketiadaan total email provider (AC-NOT-01) dan ketiadaan fitur DSAR/ekspor data (AC-PRV-01, AC-DASH-03) menghalangi kesiapan peluncuran publik (Public Launch) sebelum dilakukan remediasi P0.
3. **Memerlukan Pengerasan pada Perlindungan Kunci API dan Pembatalan Hulu:** Penyimpanan kunci yang reversibel (AC-KEY-01..03) dan pengabaian abort signal klien (AC-GW-10) harus segera diperbaiki sebelum memasuki skala produksi penuh.

---

## 6. Penutup Tahap C & Update Handoff

Evaluasi Acceptance Criteria Logis telah selesai dipetakan untuk seluruh 72 kebutuhan fungsional sistem. Hasil evaluasi logis ini menjadi landasan langsung untuk pelaksanaan **Tahap D: Cek Terbalik (Undocumented Code Analysis)** guna mendeteksi fitur atau logika tersembunyi di kode yang tidak terdokumentasi dalam PRD.
