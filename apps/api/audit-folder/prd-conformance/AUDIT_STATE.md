# AUDIT HANDOFF — Kelanjutan Audit PRD Conformance
**Proyek:** Platform Web AI API Gateway (Morphic)
**Workspace:** `c:\Users\esc\Desktop\morphic`
**Output audit:** `c:\Users\esc\Desktop\morphic\audit-out\prd-conformance\`
**Tanggal serah terima:** 4 Oktober 2026

---

## Instruksi untuk Agent Penerus

Anda adalah auditor senior (READ-ONLY). Baca file ini terlebih dahulu, lalu lanjutkan dari tahap yang belum selesai.

**Aturan mutlak:**
1. Jangan edit, hapus, atau pindahkan file yang ada.
2. Jangan git commit/push/checkout/reset.
3. Jangan jalankan app dengan key/data produksi.
4. Jangan tampilkan nilai penuh secret (tulis `xxxx...[REDACTED]`).
5. Output hanya ke `audit-out/prd-conformance/`.
6. Jangan menebak — jika tidak bisa dibuktikan dari kode, tulis TDV.

---

## Status Tahap Audit

| Tahap | File Output | Status |
|---|---|---|
| **A** — Ekstraksi kebutuhan PRD | `A-requirements.md` | ✅ SELESAI (178 butir diekstrak) |
| **B1** — FR-AUTH + AUTHZ | `B1-auth.md` | ✅ SELESAI (lihat temuan di bawah) |
| **B2** — FR-KEY | `B2-keys.md` | ✅ SELESAI (lihat temuan di bawah) |
| **B3** — FR-GW (gateway) | `B3-gateway.md` | ✅ SELESAI (lihat temuan di bawah) |
| **B4** — FR-BILL | `B4-billing.md` | ✅ SELESAI (lihat temuan di bawah) |
| **B5** — FR-DASH + FR-ADM | `B5-dashboard-admin.md` | ✅ SELESAI (lihat temuan di bawah) |
| **B6** — FR-ABU + FR-NOT + FR-PRV | `B6-abuse-privacy.md` | ✅ SELESAI (lihat temuan di bawah) |
| **C** — Acceptance criteria logis | `C-acceptance.md` | ✅ SELESAI (lihat ringkasan di bawah) |
| **D** — Cek terbalik (undocumented) | `D-undocumented.md` | ✅ SELESAI (lihat ringkasan di bawah) |
| **E** — Kesesuaian skema DB & API | `E-schema-api.md` | ✅ SELESAI (lihat ringkasan di bawah) |
| **F** — Ringkasan & rencana tindak | `F-summary.md` | ✅ SELESAI (52 findings aktif terangkum) |
| **Fix Plan** — Rencana perbaikan teknis | `audit-out/fix-plan/` | ✅ SELESAI (5 dokumen fix plan lengkap) |

---

## Konfirmasi Penting dari Pemilik Kode

1. **`.env.example` AMAN** — Konfirmasi langsung dari pemilik. File berisi placeholder (`isi_dari_google_cloud_console`, nilai kosong, `000...`). Tidak di-push ke GitHub. **Temuan T-B1-04 sudah DICABUT** dari B1-auth.md.

2. **Stack teknologi teridentifikasi:**
   - Backend API: **Hono** (Bun runtime) — `apps/api/`
   - Frontend: **Next.js 16** (React 19) — `apps/web/`
   - DB ORM: **Drizzle ORM** + **PostgreSQL** (Neon) — `packages/db/`
   - Auth: **Better Auth v1.3.0** — email/password + Google + GitHub OAuth
   - Kriptografi key: **Node.js crypto** — AES-256-GCM + SHA-256
   - Payment: **Duitku** + **PayPal** (sandbox)
   - Nama platform: **Morphic** (`morphic.cloud`)

---

## Temuan B1 yang Sudah Dikonfirmasi (Ringkasan)

| Kode | Severity | Status | Isu |
|---|---|---|---|
| T-B1-01 | 🔴 Kritis | OPEN | MFA/TOTP tidak ada — plugin `twoFactor` Better Auth tidak di-enable di `auth.ts:50` |
| T-B1-02 | 🟠 Tinggi | OPEN | `GET /v1/keys` mengembalikan plaintext key via `decryptApiKey()` — `keys.ts:111` |
| T-B1-03 | 🟠 Tinggi | OPEN | CAPTCHA opsional (env-driven), tidak di-enforce wajib di production |
| T-B1-04 | ~~Kritis~~ | **DICABUT** | .env.example hanya placeholder, aman |
| T-B1-05 | 🟡 Sedang | OPEN | `deleteOwnAccount` CASCADE hapus data keuangan — melanggar DM-RULE-05 |
| T-B1-06 | 🟡 Sedang | OPEN | Tidak ada UI halaman forgot/reset password di frontend |
| T-B1-07 | 🟡 Sedang | OPEN | Kolom `tos_version`/`aup_version` tidak ada di tabel `users` — DEVIASI PRD |
| T-B1-09 | 🟡 Sedang | OPEN | Hardcoded fallback key `'morphic-secret-salt-default-key-32b'` di `keys.ts:35` |

---

## Temuan B2 yang Dikonfirmasi (Ringkasan)

| Kode | Severity | Status | Isu |
|---|---|---|---|
| T-B2-01 | 🟠 Tinggi | OPEN | Pipa lengkap penyimpanan plaintext key reversibel (`encrypted_key` di DB) & tombol reveal/copy berulang di UI — melanggar FR-KEY-02/03 & KEY-02/03 |
| T-B2-02 | 🟡 Sedang | OPEN | Tidak ada batas jumlah key per akun (unlimited key generation) — melanggar FR-KEY-09 & KEY-13 |
| T-B2-03 | 🟡 Sedang | OPEN | Revoke key menggunakan hard-delete (`DELETE FROM api_keys`) alih-alih soft-delete — merusak jejak audit forensik (FR-KEY-04 & DM-ENT-04) |
| T-B2-04 | 🟡 Sedang | OPEN | Ketiadaan audit log siklus hidup API key (create/revoke) — melanggar FR-KEY-08 & KEY-13 |
| T-B2-05 | 🟡 Sedang | OPEN | Rotasi key dengan masa tenggang (grace period) belum diimplementasikan — melanggar FR-KEY-05 & API-CON-KEYS |
| T-B2-06 | 🟡 Sedang | OPEN | Batas per key bersifat statis-global (120 RPM, 5 concurrency); batas TPM/quota/spend cap per key & header `Retry-After` hilang — melanggar FR-KEY-06 & API-GW-RESPHDR |
| T-B2-07 | 🔵 Rendah | OPEN | Inkonsistensi implementasi generator key: backend API pakai hex (67 char), shared/FE pakai base64url (46 char) — DEVIASI |
| T-B2-08 | 🔵 Rendah | OPEN | Gateway auth tidak mendukung header `x-api-key` (hanya `Authorization: Bearer mp-...`) — DEVIASI |
| T-B2-09 | 🔵 Rendah | OPEN | IP allowlist per key belum diimplementasikan — FR-KEY-07 / KEY-09 (Fase 1 'Could Have') |

---

## Temuan B3 yang Dikonfirmasi (Ringkasan)

| Kode | Severity | Status | Isu |
|---|---|---|---|
| T-B3-01 | 🟠 Tinggi | OPEN | Client abort signal diabaikan di `router.ts:180-186` (`timeoutSignal` menimpa `req.signal`); request & biaya hulu tetap berjalan saat klien disconnect — melanggar FR-GW-10 & PROXY-05 |
| T-B3-02 | 🟠 Tinggi | OPEN | Ketiadaan failover otomatis saat runtime request gagal di `v1.ts:278-321` & ketiadaan pool key hulu (single upstream credential) — melanggar FR-GW-04, FR-GW-05 & PROXY-10 |
| T-B3-03 | 🟡 Sedang | OPEN | Ketiadaan pembatasan ukuran request body (`bodyLimit` middleware) di Hono sebelum `c.req.json()` — potensi memory exhaustion DoS (CWE-400, PROXY-04) |
| T-B3-04 | 🟡 Sedang | OPEN | State Circuit Breaker disimpan dan di-update di PostgreSQL per-request (`circuit-breaker.ts:109`) membebani DB I/O — melanggar OPS-SLO-01 & NFR-01/05 |
| T-B3-05 | 🟡 Sedang | OPEN | Estimasi token streaming SSE menggunakan heuristik arbitrer kasar (`chunksReceived * 8`) jika provider tidak mengirim `usage` object — melanggar FR-GW-01 & PROXY-13 |
| T-B3-06 | 🟡 Sedang | OPEN | Format respons error tidak menyertakan `request_id` di JSON body dan header `X-Request-Id` tidak di-set di HTTP response — melanggar FR-GW-08 & API-ERR-SCHEME |
| T-B3-07 | 🔵 Rendah | OPEN | Endpoint `/v1/models` tidak memfilter daftar model berdasarkan scope/organisasi key — melanggar FR-GW-02 & DM-ENT-10 |
| T-B3-08 | 🔵 Rendah | OPEN | Endpoint `/v1/embeddings` belum diimplementasikan — FR-GW-03 & API-GW-03 (Fase 2 'Should') |

---

## Temuan B4 yang Dikonfirmasi (Ringkasan)

| Kode | Severity | Status | Isu |
|---|---|---|---|
| T-B4-01 | 🟠 Tinggi | OPEN | Ketiadaan inbound webhook untuk PayPal di `webhooks.ts`; fulfillment kredit PayPal bergantung penuh pada client capture polling yang rentan drop-off — melanggar FR-BILL-03 & BILL-05/06 |
| T-B4-02 | 🟡 Sedang | OPEN | Fitur unduh invoice/kuitansi resmi (PDF/HTML) tidak ada di backend/frontend meskipun dijanjikan di FAQ billing web — melanggar FR-BILL-07, BILL-13 & POL-PRIC-04 |
| T-B4-03 | 🟡 Sedang | OPEN | Ketiadaan notifikasi saldo rendah (low-balance email/alerting) sebelum akun kehabisan kredit dan ditolak 402 — melanggar FR-BILL-06 & BILL-02 |
| T-B4-04 | 🟡 Sedang | OPEN | Ketiadaan alur pemrosesan refund, dispute, dan chargeback payment gateway serta penangguhan akun terkait — melanggar FR-BILL-08 & BILL-09 |
| T-B4-05 | 🟡 Sedang | OPEN | Ketiadaan pencatatan modal hulu pada tabel `models` dan sistem deteksi/alarm margin negatif — melanggar FR-BILL-05, BILL-12 & OPS-ALT-02 |
| T-B4-06 | 🔵 Rendah | OPEN | Kolom referensi mutasi di `credit_ledger` tidak memiliki constraint `UNIQUE` di level DB — melanggar FR-BILL-01 & DM-RULE-01 |
| T-B4-07 | 🔵 Rendah | OPEN | Klaim kode promo tidak membatasi multi-accounting via IP atau device fingerprint — melanggar FR-BILL-09 & BILL-10 |
| T-B4-08 | 🔵 Rendah | OPEN | Rincian pajak PPN (11%/12%) tidak dihitung atau dicantumkan pada paket dan transaksi — melanggar FR-BILL-11 & LEGAL-04 |

---

## Temuan B5 yang Dikonfirmasi (Ringkasan)

| Kode | Severity | Status | Isu |
|---|---|---|---|
| T-B5-01 | 🟠 Tinggi | OPEN | Skema RBAC admin bersifat biner (`admin`/`user`) tanpa pemisahan wewenang granular (finance/support/security), tanpa MFA admin wajib, dan tanpa IP allowlist — melanggar FR-ADM-01 & FE-04/AUTHZ-04 |
| T-B5-02 | 🟠 Tinggi | OPEN | Ketiadaan fitur ekspor CSV untuk log penggunaan (usage) dan riwayat transaksi keuangan di dasbor pengguna maupun admin — melanggar FR-DASH-03 & AUTHZ-02 |
| T-B5-03 | 🟡 Sedang | OPEN | Ketiadaan modul Abuse Queue dan sistem review metadata penyalahgunaan di panel admin (`/admin/abuse`) serta ketiadaan tabel `abuse_cases` — melanggar FR-ADM-05 & AI-08/09 |
| T-B5-04 | 🟡 Sedang | OPEN | Ketiadaan laporan rekonsiliasi margin hulu vs pendapatan dan alarm margin negatif di konsol admin — melanggar FR-ADM-06, BILL-12 & OPS-ALT-02 |
| T-B5-05 | 🟡 Sedang | OPEN | Dasbor pengguna tidak memiliki visualisasi grafik tren biaya dan proyeksi sisa hari saldo (burn-rate) — melanggar FR-DASH-02 |
| T-B5-06 | 🟡 Sedang | OPEN | Penampil audit log admin (`/admin/audit`) dibatasi statis 100 entri tanpa filter pencarian dan tanpa fitur ekspor — melanggar FR-ADM-07 & LOG-01/03 |
| T-B5-07 | 🔵 Rendah | OPEN | Playground uji model belum tersedia di web dasbor — FR-DASH-05 & AI-05 (Fase 2 'Should') |
| T-B5-08 | 🔵 Rendah | OPEN | Halaman publik status sistem / riwayat insiden (`/status`) belum tersedia — FR-DASH-06 (Fase 2 'Should') |
| T-B5-09 | 🔵 Rendah | OPEN | Fitur impersonasi pengguna oleh tim support belum tersedia — FR-ADM-08 & AUTHZ-07 (Fase 1 'Could') |
| T-B5-10 | 🔵 Rendah | OPEN | Header Content-Security-Policy (CSP) masih menggunakan mode `Report-Only` (belum enforced) di `next.config.mjs` — FE-02 |

---

## Temuan B6 yang Dikonfirmasi (Ringkasan)

| Kode | Severity | Status | Isu |
|---|---|---|---|
| T-B6-01 | 🟠 Tinggi | OPEN | Ketiadaan infrastruktur pengiriman email transaksional di platform (tidak ada Resend/Nodemailer/SMTP); semua email verifikasi, reset password, bukti bayar & notifikasi mati — melanggar FR-NOT-01 & FR-AUTH-01/03 |
| T-B6-02 | 🟠 Tinggi | OPEN | Ketiadaan sarana dan antarmuka ekspor data pribadi (DSAR) untuk kepatuhan regulasi privasi — melanggar FR-PRV-01, DATA-04 & POL-DATA-04 |
| T-B6-03 | 🟡 Sedang | OPEN | Ekstraksi IP klien di `session-ratelimit.ts` rentan terhadap spoofing header `X-Forwarded-For`, dan gateway API inferensi tidak memiliki rate limiting IP — melanggar FR-ABU-01, T-05 & KEY-08 |
| T-B6-04 | 🟡 Sedang | OPEN | Ketiadaan deteksi anomali perilaku pengguna (spike/geo-hopping/carding) dan ketiadaan auto-suspend otomatis berbasis abuse — melanggar FR-ABU-02/03, KEY-10 & LOG-04 |
| T-B6-05 | 🟡 Sedang | OPEN | Ketiadaan spanduk persetujuan cookie (Cookie Consent Banner) pada antarmuka web — melanggar FR-PRV-03 & DATA-07 |
| T-B6-06 | 🟡 Sedang | OPEN | Ketiadaan pusat bantuan terpadu (help center/tiket), form kontak keamanan, dan kanal resmi laporan abuse dengan SLA takedown — melanggar FR-NOT-02, FR-ABU-05 & LEGAL-08 |
| T-B6-07 | 🔵 Rendah | OPEN | Kebijakan Privasi tidak mencantumkan daftar sub-prosesor pihak ketiga dan tidak menyediakan dokumen DPA yang dapat diunduh — melanggar FR-PRV-05 & LEGAL-05 |
| T-B6-08 | 🔵 Rendah | OPEN | Fitur retensi log opt-in debug dengan masa kedaluwarsa TTL belum tersedia — FR-PRV-04 & AI-02 |
| T-B6-09 | 🔵 Rendah | OPEN | Modul KYC bertingkat untuk pengeluaran tinggi belum diimplementasikan — FR-ABU-06 & LEGAL-06 (Fase 2 'Should') |
| T-B6-10 | 🔵 Rendah | OPEN | Fitur webhook notifikasi ke sistem pelanggan belum tersedia — FR-NOT-04 (Fase 3 'Could') |

---

## Peta File Kode yang Relevan

```
morphic/
├── apps/
│   ├── api/src/
│   │   ├── app.ts                  — routing utama Hono
│   │   ├── index.ts                — entry point
│   │   ├── ratelimit.ts            — Redis rate limit
│   │   ├── middleware/
│   │   │   ├── auth.ts             — API key auth (SHA-256 lookup)
│   │   │   ├── session-auth.ts     — session cookie/bearer auth
│   │   │   ├── session-ratelimit.ts
│   │   │   └── logger.ts
│   │   ├── routes/
│   │   │   ├── v1.ts               — gateway: /v1/chat/completions, /v1/models
│   │   │   ├── keys.ts             — CRUD API key
│   │   │   ├── account.ts          — balance, usage, transactions
│   │   │   ├── payments.ts         — payment initiation
│   │   │   ├── webhooks.ts         — incoming payment webhooks
│   │   │   ├── redeem.ts           — redeem codes
│   │   │   ├── catalog.ts          — model catalog
│   │   │   └── quickstart.ts
│   │   ├── domain/
│   │   │   ├── router.ts           — upstream provider routing
│   │   │   └── circuit-breaker.ts  — circuit breaker
│   │   └── lib/
│   │       ├── alert.ts            — alerting (Telegram)
│   │       ├── duitku.ts           — Duitku payment gateway
│   │       ├── paypal.ts           — PayPal integration
│   │       ├── paypal-reconcile.ts
│   │       └── redis-store.ts
│   └── web/src/
│       ├── lib/
│       │   ├── auth.ts             — Better Auth config
│       │   ├── auth-client.ts      — client-side auth hooks
│       │   ├── actions.ts          — server actions (user-facing)
│       │   ├── admin-actions.ts    — server actions (admin)
│       │   ├── api-client.ts       — fetch helper ke backend API
│       │   └── models-data.ts      — model catalog (frontend)
│       └── app/
│           ├── admin/              — panel admin (Next.js pages)
│           ├── dashboard/          — user dashboard
│           └── login/              — login & registrasi
├── packages/
│   ├── db/src/
│   │   ├── schema.ts               — ⭐ Drizzle schema (sudah dibaca lengkap)
│   │   ├── billing.ts              — billing helpers (grantCredits dll)
│   │   ├── index.ts                — DB exports
│   │   └── e2e.ts                  — E2E test helpers
│   └── shared/src/
│       ├── keys.ts                 — key generation + AES-256-GCM encryption
│       ├── provider-crypto.ts      — provider credential encryption
│       ├── credits.ts              — credit calculation
│       ├── models.ts               — model types
│       └── types.ts
├── PRD_AI_API_GATEWAY.md           — ⭐ Sumber kebenaran PRD (697 baris, SUDAH DIBACA)
└── SECURITY_AUDIT_CHECKLIST.md     — ⭐ Checklist keamanan (723 baris, SUDAH DIBACA)
```

---

## Ringkasan Evaluasi Tahap C (Acceptance Criteria)

- **Total Kebutuhan Fungsional Dievaluasi:** 72 Butir (FR-AUTH s/d FR-PRV)
- **PASSED (Memenuhi Skenario Penuh):** 15 Butir (20.8%) — Mutasi ledger append-only, isolasi locking saldo `FOR UPDATE`, otorisasi OAuth PKCE, Zero Data Retention prompt, dokumentasi multi-bahasa.
- **PARTIAL (Memenuhi Sebagian):** 15 Butir (20.8%) — Webhook Duitku (tanpa PayPal webhook), streaming SSE (tanpa token precision), admin model catalog (tanpa wewenang peran finance).
- **FAILED (Gagal Skenario Logis):** 34 Butir (47.2%) — Ketiadaan email provider (AC-NOT-01), penyimpanan key reversibel (AC-KEY-01..03), client abort signal diabaikan hulu (AC-GW-10), ketiadaan ekspor CSV & DSAR (AC-DASH-03, AC-PRV-01), hapus akun cascade ledger (AC-PRV-02).
- **N/A (Fase 2 & 3):** 8 Butir (11.2%) — Embeddings, Playground, Status Page, KYC, Auto Topup, Organisasi/Tim, Webhook Notifikasi.

---

## Ringkasan Evaluasi Tahap D (Cek Terbalik / Undocumented Features)

- **Total Temuan Tidak Terdokumentasi:** 6 Rute API (D-RT-01..06) & 7 Entitas/Kolom DB (D-DB-01..07)
- **Shadow Features Kunci:**
  1. `POST /webhooks/mock`: Webhook QRIS tiruan aktif di router produksi tanpa guard environment (Risiko Tinggi D-SK-01).
  2. Arsitektur **Entitlements & Time-Bound Model Pass**: Tabel `entitlements`, `packages.duration_hours`, dan prioritas penagihan `pickSource` tidak ada di PRD (D-DB-01).
  3. Konversi Kurs Statis Hardcoded: 1 USD = Rp 16.000 di `payments.ts:186` (D-SK-02).
  4. Public Shell Script Installer: `GET /quickstart/opencode.sh` melayani file bash dinamis publik tanpa auth (D-RT-02).
  5. In-Memory Throttling: `lastPollMap` pada proses Node membatasi keefektifan di arsitektur multi-instance (D-SK-04).
  6. Skrip Eskalasi Admin Out-of-Band: `packages/db/src/make-admin.ts` mengubah peran admin tanpa jejak audit log (D-SK-03).

---

## Ringkasan Evaluasi Tahap E (Skema Database & Kontrak API)

- **Skema Database PRD §13 vs Kode:**
  - 11 Tabel Terimplementasi Selaras/Parsial.
  - 3 Tabel Hilang Total: `organizations`, `memberships`, `abuse_cases`, `dsar_requests` (serta `kyc_records` Fase 2).
  - 3 Tabel Shadow: `entitlements`, `packages` (overloaded), `redeem_codes`/`redemptions`.
  - Pelanggaran Kritis Skema: `api_keys.encrypted_key` menyimpan ciphertext kunci reversibel; kolom konfigurasi limit per-key (`rpm`, `tpm`, `daily_quota`, `spend_cap`, `scopes`) tidak ada di tabel `api_keys`.
  - `credit_ledger.reference` tidak memiliki UNIQUE constraint di DDL DB.
- **Kontrak Header HTTP Gateway PRD §14.1:**
  - `X-Request-Id`: HILANG dari response header.
  - `X-RateLimit-*`: HILANG dari response header.
  - `Retry-After`: HILANG saat status 429.
  - `X-Morphic-Warning`: TERSEDIA saat memanggil model deprecated.
- **Format Error JSON PRD §14.4:**
  - Field `request_id` HILANG dari body JSON error gateway.
  - Inkonsistensi string code (`insufficient_credits` vs `insufficient_balance`).

---

## Panduan Tahap F (Ringkasan Eksekutif & Rencana Tindak Lanjut → F-summary.md)

**Tujuan Tahap F:**
Menyusun laporan penutup komprehensif yang mengintegrasikan seluruh temuan dari Tahap A sampai Tahap E, menyajikan:
1. **Ringkasan Eksekutif Terpadu:** Skor kepatuhan keseluruhan platform Morphic terhadap PRD dan Standar Keamanan.
2. **Matriks Lengkap Seluruh Temuan Audit:** Tabel terpadu seluruh temuan (T-B1 s/d T-B6, AC failures, D-SK, E-DB/E-API) dengan tingkat keparahan (P0 / P1 / P2 / P3), kategori, dan file kode sumber.
3. **Peta Jalan Remediasi Berbasis Prioritas (Remediation Roadmap):**
   - **Prioritas P0 (Blocker Peluncuran Publik):** Perbaikan yang wajib diselesaikan sebelum platform melayani pengguna eksternal / transaksi nyata.
   - **Prioritas P1 (Tinggi - Sprint Pertama Pasca Rilis):** Perbaikan penting terkait kepatuhan regulasi, resilience hulu, dan integritas data.
   - **Prioritas P2 (Sedang):** Penyempurnaan fitur dasbor, observabilitas, dan pelaporan admin.
   - **Prioritas P3 (Rendah / Fase Lanjutan):** Alokasi fitur Fase 2 dan Fase 3.
4. **Kesimpulan Kesiapan Rilis (*Production Readiness Verdict*):** Rekomendasi formal apakah platform layak rilis publik saat ini.

---

*Diperbarui: 4 Oktober 2026. Tahap E selesai. Lanjutkan audit ke Tahap F (Tahap Terakhir).*
