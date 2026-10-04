# Tahap F — Ringkasan Eksekutif Audit PRD Conformance

**Platform:** Morphic AI API Gateway (`morphic.cloud`)  
**Stack:** Hono (Bun) API · Next.js 16 · Drizzle/PostgreSQL (Neon) · Better Auth v1.3.0 · Duitku + PayPal  
**Periode audit:** Tahap A–E (komprehensif, code-level)  
**Total butir PRD dievaluasi:** 178  
**Total findings aktif:** 52 (B1–B6: 51, D: 6, E: header/skema)  
**Total AC dievaluasi:** 72 → 15 PASSED (20.8%) · 15 PARTIAL (20.8%) · 34 FAILED (47.2%) · 8 N/A

---

## 1. Scorecard Modul

| Modul | IMPL / PARTIAL / MISSING / FAIL | Keparahan Tertinggi | Findings |
|---|---|---|---|
| **FR-AUTH** (autentikasi) | 2/4/0/2 | 🟠 Tinggi | T-B1-01..T-B1-09 (9 aktif) |
| **FR-KEY** (API key) | 1/2/4/2 | 🟠 Tinggi | T-B2-01..T-B2-09 (9 aktif) |
| **FR-GW** (gateway) | 3/6/1/2 | 🟠 Tinggi | T-B3-01..T-B3-08 (8 aktif) |
| **FR-BILL** (billing) | 2/3/5/2 | 🟠 Tinggi | T-B4-01..T-B4-08 (8 aktif) |
| **FR-DASH+ADM** (dashboard/admin) | 3/4/3/0 | 🟠 Tinggi | T-B5-01..T-B5-10 (10 aktif) |
| **FR-ABU+NOT+PRV** (abuse/notif/privasi) | 0/1/9/0 | 🟠 Tinggi | T-B6-01..T-B6-10 (10 aktif) |
| **Shadow/undocumented** | — | 🟠 Tinggi | D-SK-01..D-SK-04, D-DB-01, D-RT-02 |
| **Skema & API contract** | — | 🔴 Kritis | E: 4 tabel hilang, 4 header hilang |

---

## 2. Top-10 Findings Berdasarkan Dampak Bisnis

| # | ID | Judul | Keparahan | Dampak |
|---|---|---|---|---|
| 1 | **T-B2-01** | API key disimpan reversibel (AES-GCM); dapat di-reveal kapan saja | 🟠 Tinggi | Kebocoran DB → seluruh key pengguna terbuka |
| 2 | **T-B6-01** | Nol infrastruktur email transaksional | 🔴 Kritis (AC) | Verifikasi email mati, reset password mati, notifikasi saldo nol |
| 3 | **T-B4-01** | Tidak ada inbound PayPal webhook server-to-server | 🟠 Tinggi | Abandoned order → kredit tidak masuk, dana pengguna terpotong |
| 4 | **T-B1-05** | Hapus akun CASCADE hapus data keuangan permanen | 🟠 Tinggi | Pelanggaran DM-RULE-05, UU PDP, retensi pajak |
| 5 | **T-B3-01** | Client abort signal diabaikan di upstream fetch | 🟠 Tinggi | Biaya token upstream terbuang saat klien disconnect |
| 6 | **T-B5-01** | RBAC admin biner + nol MFA + nol IP allowlist | 🟠 Tinggi | Satu akun admin kompromi = seluruh platform |
| 7 | **D-SK-01** | `/webhooks/mock` aktif produksi tanpa NODE_ENV guard | 🟠 Tinggi | Attack surface: top-up kredit palsu jika secret bocor |
| 8 | **T-B6-02** | Tidak ada DSAR interface / tabel `dsar_requests` | 🟠 Tinggi | Pelanggaran UU PDP Pasal 34 (respons ≤ 30 hari) |
| 9 | **T-B1-01** | MFA/TOTP tidak aktif; admin login hanya email+password | 🟠 Tinggi | ATO risk pada akun admin |
| 10 | **T-B3-02** | Nol failover runtime; credential provider tunggal | 🟠 Tinggi | Provider primer down = downtime total |

---

## 3. Ringkasan Findings Per Tahap

### Tahap B1 — Autentikasi & Otorisasi
| ID | Severity | Judul | Status |
|---|---|---|---|
| T-B1-01 | 🟠 | MFA/TOTP tidak aktif; admin tanpa MFA | Aktif |
| T-B1-02 | 🟠 | Key plaintext dikembalikan di `GET /v1/keys` | Aktif (diperluas T-B2-01) |
| T-B1-03 | 🟡 | `autoSignIn: true` bypass verifikasi email | Aktif |
| T-B1-04 | ~~🟠~~ | Secret hardcoded di `.env.example` | **DICABUT** (placeholder aman) |
| T-B1-05 | 🟡 | Hapus akun CASCADE hapus data keuangan | Aktif |
| T-B1-06 | 🟡 | CAPTCHA tidak wajib di production | Aktif |
| T-B1-07 | 🟡 | Password hash: scrypt (bukan Argon2id per PRD) | TDV |
| T-B1-08 | 🟡 | Reset password UI tidak ada di frontend | Aktif |
| T-B1-09 | 🔵 | `requireAdmin()` tanpa IP allowlist/MFA | Aktif (subset T-B5-01) |

### Tahap B2 — Manajemen API Key
| ID | Severity | Judul | Status |
|---|---|---|---|
| T-B2-01 | 🟠 | Penyimpanan reversibel + reveal anywhere | Aktif |
| T-B2-02 | 🟠 | `GET /v1/keys` kembalikan plaintext key | Aktif |
| T-B2-03 | 🟡 | Rotasi key (`POST /v1/keys/:id/rotate`) belum ada | Aktif |
| T-B2-04 | 🟡 | Tidak ada audit log siklus hidup key | Aktif |
| T-B2-05 | 🟡 | Tidak ada batasan kuota key per akun | Aktif |
| T-B2-06 | 🟡 | Header 429 (`Retry-After`, `X-RateLimit-*`) hilang | Aktif |
| T-B2-07 | 🔵 | Tidak ada TPM / daily quota / spend cap per key | Aktif |
| T-B2-08 | 🔵 | Tidak ada IP allowlist per key | N/A Fase 1 'Could' |
| T-B2-09 | 🔵 | Nama/deskripsi key tidak bisa diedit | Aktif |

### Tahap B3 — Gateway Inferensi
| ID | Severity | Judul | Status |
|---|---|---|---|
| T-B3-01 | 🟠 | Client abort signal diabaikan di upstream fetch | Aktif |
| T-B3-02 | 🟠 | Nol failover runtime; provider tunggal | Aktif |
| T-B3-03 | 🟡 | Tidak ada `bodyLimit` middleware (DoS risk) | Aktif |
| T-B3-04 | 🟡 | Circuit breaker state di PostgreSQL (bukan Redis) | Aktif |
| T-B3-05 | 🟡 | SSE token estimation: heuristic `chunks × 8` | Aktif |
| T-B3-06 | 🟡 | Error response tanpa `request_id` + header `X-Request-Id` | Aktif |
| T-B3-07 | 🔵 | `/v1/models` tidak filter per scope/org key | Aktif |
| T-B3-08 | 🔵 | `/v1/embeddings` belum ada | N/A Fase 2 |

### Tahap B4 — Billing & Pembayaran
| ID | Severity | Judul | Status |
|---|---|---|---|
| T-B4-01 | 🟠 | Nol inbound PayPal webhook | Aktif |
| T-B4-02 | 🟡 | Invoice/receipt download tidak ada | Aktif |
| T-B4-03 | 🟡 | Tidak ada notifikasi saldo rendah | Aktif |
| T-B4-04 | 🟡 | Tidak ada alur refund/chargeback/dispute | Aktif |
| T-B4-05 | 🟡 | Tidak ada tracking biaya hulu / margin negatif | Aktif |
| T-B4-06 | 🔵 | `credit_ledger.reference` tanpa UNIQUE constraint | Aktif |
| T-B4-07 | 🔵 | Promo redemption tanpa IP/device fingerprint | Aktif |
| T-B4-08 | 🔵 | PPN 11%/12% tidak dihitung | Aktif |

### Tahap B5 — Dashboard & Admin
| ID | Severity | Judul | Status |
|---|---|---|---|
| T-B5-01 | 🟠 | RBAC biner + nol MFA + nol IP allowlist admin | Aktif |
| T-B5-02 | 🟠 | Nol ekspor CSV usage/transaksi | Aktif |
| T-B5-03 | 🟡 | Nol Abuse Queue / tabel `abuse_cases` | Aktif |
| T-B5-04 | 🟡 | Nol laporan rekonsiliasi margin / alarm margin negatif | Aktif |
| T-B5-05 | 🟡 | Nol grafik biaya + burn-rate projection di dashboard | Aktif |
| T-B5-06 | 🟡 | Audit log: statis 100 entri, tanpa filter/ekspor | Aktif |
| T-B5-07 | 🔵 | Model playground belum ada | N/A Fase 2 |
| T-B5-08 | 🔵 | Status page publik belum ada | N/A Fase 2 |
| T-B5-09 | 🔵 | User impersonation belum ada | N/A Fase 1 'Could' |
| T-B5-10 | 🔵 | CSP header masih Report-Only | Aktif |

### Tahap B6 — Abuse, Notifikasi, Privasi
| ID | Severity | Judul | Status |
|---|---|---|---|
| T-B6-01 | 🟠 | Nol infrastruktur email transaksional | Aktif |
| T-B6-02 | 🟠 | Nol DSAR interface / tabel `dsar_requests` | Aktif |
| T-B6-03 | 🟡 | IP extraction spoofable; nol IP rate limit di gateway | Aktif |
| T-B6-04 | 🟡 | Nol deteksi anomali perilaku; nol auto-suspend | Aktif |
| T-B6-05 | 🟡 | Nol Cookie Consent Banner | Aktif |
| T-B6-06 | 🟡 | Nol help center / tiket / abuse report channel | Aktif |
| T-B6-07 | 🔵 | Privacy Policy tanpa sub-processor list / DPA | Aktif |
| T-B6-08 | 🔵 | Nol opt-in debug log retention dengan TTL | Aktif |
| T-B6-09 | 🔵 | KYC belum ada | N/A Fase 2 |
| T-B6-10 | 🔵 | Webhook notifikasi pelanggan belum ada | N/A Fase 3 |

### Tahap D — Shadow Features & Undocumented Behaviors
| ID | Severity | Judul | Status |
|---|---|---|---|
| D-SK-01 | 🟠 | `/webhooks/mock` aktif produksi tanpa NODE_ENV guard | Aktif |
| D-SK-02 | 🟡 | Kurs hardcoded 1 USD = Rp 16.000 | Aktif |
| D-DB-01 | 🟡 | `entitlements` & `packages.duration_hours` tidak ada di PRD | Aktif |
| D-RT-02 | 🟡 | `GET /quickstart/opencode.sh` tanpa auth, bash installer publik | Aktif |
| D-SK-03 | 🟡 | `make-admin.ts` tanpa `admin_audit_log` | Aktif |
| D-SK-04 | 🔵 | `lastPollMap` in-memory, tidak sinkron multi-instance | Aktif |

### Tahap E — Skema DDL & Kontrak API
- **4 tabel hilang:** `organizations`, `memberships`, `abuse_cases`, `dsar_requests`
- **3 shadow tables:** `entitlements`, `redeem_codes`, `redemptions`
- **`api_keys` tanpa kolom:** `rpm`, `tpm`, `daily_quota`, `spend_cap`, `scopes`
- **`credit_ledger.reference` tanpa UNIQUE constraint**
- **4 response header hilang (0/4):** `X-Request-Id`, `X-RateLimit-Limit-Requests`, `X-RateLimit-Remaining-Requests`, `Retry-After`
- **Error JSON tanpa `request_id`**

---

## 4. Distribusi Keparahan (Findings Aktif)

| Keparahan | Jumlah | Finding IDs |
|---|---|---|
| 🔴 Kritis (AC level) | 1 | T-B6-01 (email infra) |
| 🟠 Tinggi | 12 | T-B1-01/02, T-B2-01/02, T-B3-01/02, T-B4-01, T-B5-01/02, T-B6-01/02, D-SK-01 |
| 🟡 Sedang | 23 | T-B1-03/05/06/08, T-B2-03–06, T-B3-03–06, T-B4-02–05, T-B5-03–06, T-B6-03–06, D-SK-02/03, D-DB-01, D-RT-02 |
| 🔵 Rendah / Info | 16 | T-B1-09, T-B2-07–09, T-B3-07, T-B4-06–08, T-B5-07–10, T-B6-07–10, D-SK-04 |
| **Total aktif** | **52** | |

---

## 5. Rekomendasi Prioritas Tindakan

### P0 — Harus segera sebelum traffic produksi nyata
1. Hapus kolom `encrypted_key` + endpoint reveal → ganti dengan hash-only (T-B2-01, T-B2-02)
2. Integrasikan email provider (Resend/SES) → kirim verifikasi, reset, notif saldo (T-B6-01)
3. Tambahkan inbound PayPal webhook `POST /webhooks/paypal` (T-B4-01)
4. Guard `/webhooks/mock` dengan `NODE_ENV !== 'production'` (D-SK-01)
5. Perbaiki client abort propagation di `router.ts` dengan `AbortSignal.any()` (T-B3-01)
6. Soft-delete akun + anonimisasi PII; jangan cascade data keuangan (T-B1-05)

### P1 — Stabilitas & kepatuhan layanan
7. Aktifkan MFA untuk admin; tambahkan granular RBAC (T-B5-01, T-B1-01)
8. Tambahkan `bodyLimit` middleware Hono (T-B3-03)
9. Implementasikan runtime fallback / failover provider (T-B3-02)
10. Inject `X-Request-Id` + `Retry-After` + `X-RateLimit-*` header (T-B3-06, T-B2-06)
11. Suntikkan `stream_options: { include_usage: true }` ke upstream streaming (T-B3-05)
12. Implementasikan DSAR endpoint + tabel `dsar_requests` (T-B6-02)

### P2 — Kepatuhan regulasi & fitur pengguna
13. Cookie Consent Banner (T-B6-05)
14. Invoice/receipt PDF per transaksi (T-B4-02)
15. Notifikasi saldo rendah + email trigger (T-B4-03)
16. Ekspor CSV usage & transaksi di dashboard (T-B5-02)
17. Audit log key lifecycle (T-B2-04)
18. Pindahkan circuit breaker state ke Redis (T-B3-04)
19. Tambahkan `abuse_cases` tabel + abuse queue admin (T-B5-03)
20. IP rate limiting di gateway inferensi (T-B6-03)

### P3 — Kualitas & hardening
21. Rekonsiliasi margin hulu + alarm margin negatif (T-B5-04, T-B4-05)
22. UNIQUE constraint `credit_ledger.reference` (T-B4-06)
23. Rotasi key endpoint (T-B2-03)
24. CSP enforcement (bukan report-only) (T-B5-10)
25. Kurs dinamis USD→IDR (D-SK-02)
26. Batasan kuota key per akun (T-B2-05)

---

## 6. Keputusan Pemilik Diperlukan

| # | Keputusan | Dampak |
|---|---|---|
| OWN-01 | Apakah fitur "reveal key" (AES-GCM recover) dipertahankan? | Jika YA → buat threat model formal; Jika TIDAK → hapus `encrypted_key` sepenuhnya |
| OWN-02 | Email provider pilihan: Resend vs SES vs Nodemailer+SMTP? | Menentukan T-B6-01 implementation path |
| OWN-03 | PPN 11% / 12%: apakah wajib pada transaksi saat ini? | Konsultasi akuntan/pajak → menentukan T-B4-08 |
| OWN-04 | Kurs USD→IDR: live feed (BI API) atau tetap hardcoded dengan review bulanan? | D-SK-02 |
| OWN-05 | Hash algorithm: accept scrypt atau migrasi ke Argon2id? | T-B1-07 |
| OWN-06 | `entitlements` + `duration_hours`: fitur resmi atau technical debt? | D-DB-01 |
| OWN-07 | Refund policy: kapan & berapa batas refund? | T-B4-04 |
| OWN-08 | `/quickstart/opencode.sh`: apakah public intentional? | D-RT-02 |

---

*Laporan F-summary selesai. Input untuk `audit-out/fix-plan/`.*
