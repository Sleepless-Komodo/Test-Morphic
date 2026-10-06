# Fix Plan — 00 MASTER ORDER

**Platform:** Morphic AI API Gateway  
**Dibuat:** 2026-10-04  
**Sumber:** Audit PRD Conformance Tahap A–F (52 findings aktif)  
**Prinsip:** Tidak mengubah kode — dokumen perencanaan saja.

---

## 1. Inventaris & Klasifikasi Semua Findings

| ID | Severity | Layer | Area | Judul Singkat |
|---|---|---|---|---|
| T-B2-01 | 🟠 | BE+FE | Security | API key reversibel; reveal anywhere |
| T-B2-02 | 🟠 | BE | Security | `GET /v1/keys` kembalikan plaintext |
| T-B6-01 | 🔴 | BE | Infra | Nol email provider transaksional |
| T-B4-01 | 🟠 | BE | Billing | Nol PayPal inbound webhook |
| D-SK-01 | 🟠 | BE | Security | `/webhooks/mock` aktif produksi |
| T-B3-01 | 🟠 | BE | Gateway | Abort signal diabaikan di upstream |
| T-B1-05 | 🟠 | BE+DB | Privacy | Hapus akun CASCADE data keuangan |
| T-B5-01 | 🟠 | BE+FE | Admin | RBAC biner + nol MFA + nol IP allowlist |
| T-B1-01 | 🟠 | BE | Auth | MFA/TOTP tidak aktif |
| T-B6-02 | 🟠 | BE+FE | Privacy | Nol DSAR interface |
| T-B3-02 | 🟠 | BE | Gateway | Nol runtime failover |
| T-B5-02 | 🟠 | FE | Dashboard | Nol ekspor CSV |
| T-B1-03 | 🟡 | BE | Auth | `autoSignIn: true` bypass verifikasi |
| T-B1-06 | 🟡 | BE | Auth | CAPTCHA tidak wajib production |
| T-B1-08 | 🟡 | FE | Auth | UI forgot/reset password tidak ada |
| T-B2-03 | 🟡 | BE | Key | Rotasi key belum ada |
| T-B2-04 | 🟡 | BE | Key | Nol audit log lifecycle key |
| T-B2-05 | 🟡 | BE | Key | Nol batasan kuota key per akun |
| T-B2-06 | 🟡 | BE | Gateway | Header 429 hilang (`Retry-After` dll.) |
| T-B3-03 | 🟡 | BE | Gateway | Nol `bodyLimit` middleware |
| T-B3-04 | 🟡 | BE | Gateway | Circuit breaker state di PostgreSQL |
| T-B3-05 | 🟡 | BE | Gateway | SSE token heuristic `chunks×8` |
| T-B3-06 | 🟡 | BE | Gateway | Error JSON tanpa `request_id` |
| T-B4-02 | 🟡 | BE+FE | Billing | Nol invoice/receipt download |
| T-B4-03 | 🟡 | BE | Billing | Nol notifikasi saldo rendah |
| T-B4-04 | 🟡 | BE | Billing | Nol alur refund/chargeback |
| T-B4-05 | 🟡 | BE | Billing | Nol tracking biaya hulu/margin |
| T-B5-03 | 🟡 | BE+FE | Admin | Nol abuse queue / tabel `abuse_cases` |
| T-B5-04 | 🟡 | BE+FE | Admin | Nol rekonsiliasi margin + alarm |
| T-B5-05 | 🟡 | FE | Dashboard | Nol grafik biaya + burn-rate |
| T-B5-06 | 🟡 | FE | Admin | Audit log: statis, tanpa filter/ekspor |
| T-B6-03 | 🟡 | BE | Abuse | IP spoofable; nol IP rate limit gateway |
| T-B6-04 | 🟡 | BE | Abuse | Nol anomali detection / auto-suspend |
| T-B6-05 | 🟡 | FE | Privacy | Nol Cookie Consent Banner |
| T-B6-06 | 🟡 | FE | Support | Nol help center / tiket |
| D-SK-02 | 🟡 | BE | Billing | Kurs hardcoded 1 USD = Rp 16.000 |
| D-DB-01 | 🟡 | DB | Schema | `entitlements` tidak ada di PRD |
| D-RT-02 | 🟡 | BE | Security | `/quickstart/opencode.sh` tanpa auth |
| D-SK-03 | 🟡 | BE | Security | `make-admin.ts` tanpa audit log |
| T-B1-09 | 🔵 | BE | Admin | `requireAdmin()` tanpa IP/MFA (subset T-B5-01) |
| T-B2-07 | 🔵 | BE+DB | Key | Nol TPM/daily quota/spend cap per key |
| T-B2-09 | 🔵 | BE | Key | Nama/deskripsi key tidak bisa diedit |
| T-B3-07 | 🔵 | BE | Gateway | `/v1/models` tidak filter per scope |
| T-B4-06 | 🔵 | DB | Billing | `credit_ledger.reference` tanpa UNIQUE |
| T-B4-07 | 🔵 | BE | Billing | Promo tanpa IP/device fingerprint |
| T-B4-08 | 🔵 | BE | Billing | PPN 11%/12% tidak dihitung |
| T-B5-10 | 🔵 | FE | Security | CSP Report-Only, belum enforced |
| T-B6-07 | 🔵 | FE | Privacy | Privacy Policy tanpa sub-processor/DPA |
| T-B6-08 | 🔵 | BE | Privacy | Nol opt-in debug log TTL |
| D-SK-04 | 🔵 | BE | Infra | `lastPollMap` in-memory, multi-instance unsafe |
| T-B1-07 | TDV | BE | Auth | scrypt vs Argon2id (needs owner decision) |
| T-B2-08 | N/A | BE | Key | IP allowlist per key (Fase 1 'Could') |

---

## 2. Matriks Prioritas

### P0 — Harus sebelum traffic produksi (security/data loss/revenue loss)

| Fix ID | Findings | Layer | Estimasi Effort |
|---|---|---|---|
| **FIX-P0-01** | T-B2-01, T-B2-02 | BE+FE+DB | M (migrasi schema + 3 file) |
| **FIX-P0-02** | T-B6-01 | BE | L (integrasi Resend/SES + template) |
| **FIX-P0-03** | T-B4-01 | BE | M (1 route handler + sig verify) |
| **FIX-P0-04** | D-SK-01 | BE | XS (1 baris kondisi) |
| **FIX-P0-05** | T-B3-01 | BE | XS (`AbortSignal.any()`, 5 baris) |
| **FIX-P0-06** | T-B1-05 | BE+DB | M (soft-delete + anonimisasi PII) |

### P1 — Stabilitas, kepatuhan layanan, keamanan admin

| Fix ID | Findings | Layer | Estimasi Effort |
|---|---|---|---|
| **FIX-P1-01** | T-B5-01, T-B1-01 | BE+FE | L (MFA plugin + RBAC granular) |
| **FIX-P1-02** | T-B3-03 | BE | XS (1 middleware call) |
| **FIX-P1-03** | T-B3-02 | BE | M (fallback logic di router) |
| **FIX-P1-04** | T-B3-06, T-B2-06 | BE | S (middleware inject header) |
| **FIX-P1-05** | T-B3-05 | BE | S (`stream_options` injection) |
| **FIX-P1-06** | T-B6-02 | BE+FE+DB | L (tabel + endpoint + UI) |
| **FIX-P1-07** | T-B1-03 | BE | XS (`autoSignIn: false`) |
| **FIX-P1-08** | T-B3-04 | BE | M (Redis-based circuit breaker) |

### P2 — Regulasi & fitur pengguna

| Fix ID | Findings | Layer | Estimasi Effort |
|---|---|---|---|
| **FIX-P2-01** | T-B6-05 | FE | S (consent banner component) |
| **FIX-P2-02** | T-B4-02 | BE+FE | M (PDF generation + download endpoint) |
| **FIX-P2-03** | T-B4-03 | BE | S (threshold check + email trigger) |
| **FIX-P2-04** | T-B5-02 | FE | S (CSV export di usage + transactions) |
| **FIX-P2-05** | T-B2-04 | BE | S (audit log panggilan di keys routes) |
| **FIX-P2-06** | T-B5-03 | BE+FE+DB | M (tabel abuse_cases + UI queue) |
| **FIX-P2-07** | T-B6-03 | BE | S (real IP extraction + IP rate limit) |
| **FIX-P2-08** | T-B1-08 | FE | S (halaman forgot/reset password) |

### P3 — Hardening & kualitas

| Fix ID | Findings | Layer | Estimasi Effort |
|---|---|---|---|
| **FIX-P3-01** | T-B5-04, T-B4-05 | BE+FE | M (upstream cost tracking + alarm) |
| **FIX-P3-02** | T-B4-06 | DB | XS (1 migrasi UNIQUE constraint) |
| **FIX-P3-03** | T-B2-03 | BE+FE | M (rotate endpoint + UI) |
| **FIX-P3-04** | T-B5-10 | FE | S (CSP header enforcement) |
| **FIX-P3-05** | D-SK-02 | BE | S (integrasi live FX rate atau config) |
| **FIX-P3-06** | T-B2-05 | BE | S (quota check saat create key) |
| **FIX-P3-07** | T-B5-06 | FE | S (filter + pagination audit log) |
| **FIX-P3-08** | T-B6-04 | BE | L (anomaly detection rules) |
| **FIX-P3-09** | T-B4-07 | BE | S (IP fingerprint promo guard) |
| **FIX-P3-10** | D-SK-03 | BE | XS (tambahkan audit call di make-admin.ts) |
| **FIX-P3-11** | D-SK-04 | BE | S (Redis-backed poll state) |
| **FIX-P3-12** | T-B2-07 | BE+DB | M (kolom rpm/tpm/daily_quota schema) |
| **FIX-P3-13** | T-B3-07 | BE | S (filter /v1/models per scope) |

---

## 3. Urutan Eksekusi & Dependency Graph

```
P0-01 (key storage) ──► P0-02 (email) ──► P2-03 (notif saldo rendah)
                                        └──► P1-06 (DSAR)
P0-03 (PayPal webhook) ─── independen
P0-04 (mock guard) ──── XS, independen
P0-05 (abort signal) ─── independen
P0-06 (soft-delete) ──► P1-06 (DSAR dapat referensi anonymized user)

P1-01 (MFA+RBAC) ──► P3-07 (audit log filter — butuh peran finance)
P1-04 (headers) ──── independen, diperlukan sebelum SDK docs update
P1-08 (Redis CB) ──► P1-03 (failover — state harus sudah di Redis)

P2-06 (abuse_cases tabel) ──► P3-08 (anomaly detection — butuh tabel)
P3-01 (margin tracking) ──► diperlukan sebelum FIX-P3-09 billing alarm
```

---

## 4. Gerbang Antar Fase (Release Gates)

| Gerbang | Kondisi Wajib Terpenuhi | Blok Jika Tidak |
|---|---|---|
| **GATE-P0** | FIX-P0-01..06 semua selesai + test pass | Tidak boleh ada traffic API key production baru |
| **GATE-P1** | FIX-P1-01..08 selesai; MFA aktif di semua akun admin | Tidak boleh ada perubahan konfigurasi admin tanpa MFA |
| **GATE-P2** | FIX-P2-01 (consent) live; FIX-P2-02 (invoice) live | Tidak boleh ada kampanye marketing baru |
| **GATE-P3** | FIX-P3-02 (UNIQUE constraint) + FIX-P3-12 (schema kolom key) | Tidak boleh ada tambahan paket pricing baru |

---

## 5. Keputusan Pemilik (Harus Dijawab Sebelum Implementasi)

| ID | Pertanyaan | Diperlukan Oleh |
|---|---|---|
| **OWN-01** | Pertahankan fitur reveal key (AES-GCM) atau hapus total? | FIX-P0-01 |
| **OWN-02** | Email provider: Resend / AWS SES / Nodemailer+SMTP? | FIX-P0-02 |
| **OWN-03** | PPN 11%/12% wajib sekarang? (konsultasi akuntan) | T-B4-08 |
| **OWN-04** | Kurs USD→IDR: live BI API atau hardcoded dengan review bulanan? | FIX-P3-05 |
| **OWN-05** | Hash algo: terima scrypt atau migrasi Argon2id? | T-B1-07 |
| **OWN-06** | `entitlements` + `duration_hours`: fitur resmi atau hapus? | D-DB-01 |
| **OWN-07** | Refund policy: batas waktu & jumlah maksimal? | FIX-P2-XX (future) |
| **OWN-08** | `/quickstart/opencode.sh`: publik intentional? Perlu auth? | D-RT-02 |

---

## 6. Ringkasan File Fix Plan

| File | Isi |
|---|---|
| `FIX_BE.md` | Semua tugas backend P0→P3, format lengkap per item |
| `FIX_FE.md` | Semua tugas frontend P0→P3, label INDEPENDEN/BLOCKED_BY |
| `FIX_CONTRACT.md` | Perubahan kontrak API publik, label BREAKING vs non-breaking |
| `HUMAN_ACTIONS.md` | Tindakan manusia wajib: rotasi secret, legal, cloud, pentest |
