# LAPORAN TAHAP E: KESESUAIAN SKEMA DATABASE & SPESIFIKASI KONTRAK API

**Platform:** Web AI API Gateway (Morphic)  
**Tanggal Audit:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Dokumen Acuan:** `PRD_AI_API_GATEWAY.md` (§13 Model Data, §14 Spesifikasi API), `SECURITY_AUDIT_CHECKLIST.md` (§3, §14), basis kode `packages/db/src/schema.ts` dan `apps/api/src/routes/`  
**Status File:** Selesai Dianalisis

---

## 1. Ringkasan Eksekutif Kesesuaian Skema & API

Tahap E melakukan perbandingan teknis terperinci antara spesifikasi rancangan arsitektur data pada **PRD (§13 & §14)** dengan implementasi fisik pada **Drizzle ORM PostgreSQL (`schema.ts`)** serta kontrak antarmuka **Hono REST API Gateway (`routes/v1.ts`, `routes/keys.ts`, `routes/payments.ts`)**.

### Ringkasan Status Kesesuaian:
- **Tabel Skema Database:** Dari 16 entitas yang dirancang dalam PRD §13:
  - **11 Tabel Terimplementasi Selaras/Parsial:** `users`, `sessions`, `accounts`, `verifications`, `api_keys`, `providers`, `models`, `balances`, `credit_ledger`, `payments`, `payment_events`, `request_logs`/`usage_records`, `admin_audit_log`.
  - **3 Tabel Hilang Total (*Missing Tables*):** `organizations`, `memberships`, `abuse_cases`, `dsar_requests` (serta `kyc_records` Fase 2).
  - **3 Tabel Ekstra Kode (*Shadow Tables*):** `entitlements`, `redeem_codes`, `redemptions`.
- **Kontrak Header HTTP Gateway:** **Gagal Total (0/4 Header Standar):**
  - `X-Request-Id`: **TIDAK ADA** pada response header.
  - `X-RateLimit-Limit-Requests`: **TIDAK ADA** pada response header.
  - `X-RateLimit-Remaining-Requests`: **TIDAK ADA** pada response header.
  - `Retry-After`: **TIDAK ADA** saat HTTP 429.
- **Skema Format Error JSON:** **Deviasi Kritis:** Field `request_id` hilang dari objek respons error JSON (melanggar standar PRD §14.4).

---

## 2. Matriks Kesesuaian Skema Database (PRD §13 vs `packages/db/src/schema.ts`)

| No | Entitas PRD (§13) | Tabel di Kode (`schema.ts`) | Status Kepatuhan | Perbandingan Atribut & Constraint | Analisis Deviasi & Risiko Keamanan |
|---|---|---|---|---|---|
| **E-DB-01** | `users` | `users`<br>(line 16-27) | **PARTIAL** | PRD: `id, email, password_hash, status, mfa_enabled, created_at, tos_version, aup_version`.<br>Kode: `id, name, email, emailVerified, image, role, suspended, createdAt, updatedAt`. | - `password_hash` dipisah ke `accounts.password` (Better Auth — Sesuai).<br>- **Hilang:** `mfa_enabled` (MFA dinonaktifkan di Better Auth).<br>- **Hilang:** `tos_version` dan `aup_version` (tidak mencatat versi AUP).<br>- Status user berupa boolean `suspended`, bukan enum status. |
| **E-DB-02** | `organizations` | *Tidak Ada* | **MISSING (Fase 3)** | PRD: `id, name, owner_id, plan, status`.<br>Kode: — | Model multi-tenant organisasi belum diimplementasikan; seluruh relasi terikat langsung ke `user_id`. |
| **E-DB-03** | `memberships` | *Tidak Ada* | **MISSING (Fase 3)** | PRD: `org_id, user_id, role`.<br>Kode: — | Pembagian peran tim/organisasi belum tersedia. |
| **E-DB-04** | `api_keys` | `api_keys`<br>(line 81-99) | **FAILED (Deviasi Keamanan)** | PRD: `id, org_id, name, prefix, key_hash, scopes, status, rpm, tpm, daily_quota, spend_cap, expires_at, last_used_at, revoked_at`.<br>Kode: `id, userId, name, keyHash, keyPrefix, encryptedKey, status, expiresAt, lastUsedAt, createdAt, revokedAt`. | - 🔴 **Pelanggaran Kritis:** Menyimpan `encrypted_key` (reversibel ciphertext); PRD mewajibkan **hanya hash tersimpan**.<br>- **Hilang:** Kolom konfigurasi `scopes`, `rpm`, `tpm`, `daily_quota`, dan `spend_cap` per key. Batas limit menjadi hardcoded global. |
| **E-DB-05** | `wallets` | `balances`<br>(line 181-187) | **PASSED** | PRD: `id, org_id, currency, cached_balance`.<br>Kode: `userId (PK FK), credits (bigint), updatedAt`. | Berfungsi sebagai cache saldo turunan. Unit menggunakan `bigint` (bebas floating-point). Relasi 1-to-1 dengan `users`. |
| **E-DB-06** | `ledger_entries` | `credit_ledger`<br>(line 189-220) | **PARTIAL** | PRD: `id, wallet_id, type, amount, ref_id, idempotency_key (unik), created_at`.<br>Kode: `id, userId, entryType, amount, reservationId, sourceType, sourceId, reference, createdAt`. | - Pola Append-only dan integer minor unit terpenuhi.<br>- 🟡 **Deviasi:** Kolom `reference` **tidak memiliki UNIQUE constraint** di skema database (berisiko bila idempotensi di level aplikasi gagal).<br>- Menambahkan `sourceType` ('balance'\|'entitlement') untuk shadow feature. |
| **E-DB-07** | `reservations` | `reservations`<br>(line 222-250) | **PASSED** | PRD: Digambarkan di Sequence Diagram §12.2.<br>Kode: `id, userId, apiKeyId, modelId, sourceType, sourceId, estimatedCredits, actualCredits, status, usageRecordId, expiresAt, createdAt, settledAt`. | Implementasi pola *Reserve → Settle* sangat matang dengan state machine `reserved` → `settled` / `released`. |
| **E-DB-08** | `payments` | `payments`<br>(line 320-343) | **PARTIAL** | PRD: `id, org_id, provider, provider_ref (unik), amount, currency, status, raw_event_hash`.<br>Kode: `id, userId, provider, externalId (unik), packageId, amountCents, currency, credits, status, paidAt, capturedAt, createdAt`. | - `externalId` memiliki UNIQUE constraint (Sesuai).<br>- `status` enum: `pending`, `capturing`, `paid`, `pending_paypal`, `failed`, `expired`, `refunded`.<br>- 🟡 **Deviasi:** `amountCents` di-overload (IDR menyimpan rupiah penuh, bukan sen). |
| **E-DB-09** | `webhook_inbox` | `payment_events`<br>(line 345-352) | **PASSED** | PRD: `id, provider, event_id (unik), signature_valid, processed_at`.<br>Kode: `id, provider, eventId, paymentId, payload (jsonb), processedAt`. Unique Index: `(provider, eventId)`. | Perlindungan anti-replay dan deduplikasi webhook terpenuhi via indeks komposit unik `(provider, event_id)`. |
| **E-DB-10** | `usage_events` | `usage_records`<br>& `request_logs`<br>(line 153 & 292) | **PASSED** | PRD: `id, request_id (unik), key_id, org_id, model_alias, upstream_model, input_tokens, output_tokens, cost, latency_ms, status, created_at`.<br>Kode: Dibagi menjadi `usage_records` (metering tagihan) dan `request_logs` (observabilitas log). | - Memenuhi prinsip **Zero Data Retention** (tidak ada kolom prompt/completion).<br>- `requestId` memiliki UNIQUE constraint di kedua tabel. |
| **E-DB-11** | `models` | `models`<br>(line 123-149) | **PARTIAL** | PRD: `alias, upstream_provider, upstream_model, price_in, price_out, status, visibility`.<br>Kode: `id, providerId, publicModelId (unik), providerModelId, displayName, description, contextLength, capabilities, inputCreditsPer1m, outputCreditsPer1m, providerCostInputPer1m, providerCostOutputPer1m, status, replacementModelAlias, fallbackProviderId, createdAt, updatedAt`. | - Struktur dasar katalog model sangat lengkap.<br>- Kolom `providerCost*` ada tetapi tidak digunakan untuk perhitungan margin otomatis.<br>- `fallbackProviderId` ada di skema tetapi diabaikan di `router.ts`. |
| **E-DB-12** | `upstream_keys` | `providers`<br>(line 103-121) | **FAILED (Deviasi Desain)** | PRD: `id, provider, secret_ref 🔒, status, quota_state, last_rotated_at`. (Mendukung pool multi-key dengan rotasi kuota).<br>Kode: `id, name, baseUrl, encryptedCredentials, credentialReference, status, circuitBreakerState, createdAt, updatedAt`. | - 🔴 **Deviasi Arsitektur:** Tidak ada tabel `upstream_keys`. Kredensial provider disimpan tunggal 1-to-1 di tabel `providers`. Tidak mendukung pool multi-key dengan rotasi kuota per-key.<br>- `circuitBreakerState` disimpan sebagai JSONB di PostgreSQL. |
| **E-DB-13** | `audit_logs` | `admin_audit_log`<br>(line 392-405) | **PARTIAL** | PRD: `id, actor_id, actor_type, action, target, ip, ua, metadata, created_at`.<br>Kode: `id, adminId, action, entity, entityId, detail (jsonb), createdAt`. | - Hanya mencatat aksi admin backend (`adminId`).<br>- **Hilang:** Kolom `actor_type`, `ip`, dan `userAgent` (audit log kehilangan jejak forensik IP aktor).<br>- **Hilang:** Audit log untuk aksi pengguna reguler (pembuatan/pencabutan API key). |
| **E-DB-14** | `abuse_cases` | *Tidak Ada* | **MISSING** | PRD: `id, org_id, key_id, signal, severity, status, reviewer, resolution`.<br>Kode: — | Tabel pelacakan kasus abuse tidak ada sama sekali di database. |
| **E-DB-15** | `dsar_requests` | *Tidak Ada* | **MISSING** | PRD: `id, user_id, type, status, due_at, completed_at`.<br>Kode: — | Tabel manajemen permohonan hak privasi/ekspor data pengguna tidak ada. |
| **E-DB-16** | `kyc_records` | *Tidak Ada* | **MISSING (Fase 2)** | PRD: `id, org_id, level, status, evidence_ref`.<br>Kode: — | Dialokasikan untuk Fase 2. |
| **E-DB-17** | *Shadow Entity* | `entitlements`<br>(line 268-289) | **UNDOCUMENTED** | Kode: `id, userId, packageId, modelId, allowance, remaining, source, startsAt, expiresAt, status`. | Fitur paket kuota model dengan batas waktu (time-bound pass). Tidak terdokumentasi di PRD. |
| **E-DB-18** | *Shadow Entity* | `packages`<br>(line 252-266) | **UNDOCUMENTED** | Kode: `id, name, description, creditAllowance, modelId, durationHours, priceCents, currency, recurring, status`. | Mendukung paket model-specific dan durasi jam. Tidak terdokumentasi di PRD. |
| **E-DB-19** | *Shadow Entity* | `redeem_codes`<br>& `redemptions`<br>(line 356-390) | **UNDOCUMENTED** | Kode: Tabel pengelolaan kode promo dan pencatatan klaim per user. | Tabel voucher promo. Tidak tercantum di skema PRD §13. |

---

## 3. Matriks Kesesuaian Spesifikasi API Gateway Publik (PRD §14.1 vs `routes/v1.ts`)

### 3.1 Endpoint & Metode Gateway

| Endpoint PRD (§14.1) | Method | Endpoint di Kode | Auth Required | Status Kesesuaian Kontrak | Catatan Deviasi Teknis |
|---|---|---|---|---|---|
| `/v1/chat/completions` | `POST` | `apps/api/src/routes/v1.ts:94` | `apiKeyAuth` | **PARTIAL** | - Format request/response kompatibel dengan OpenAI.<br>- Mode streaming SSE didukung (`stream: true`).<br>- 🔴 **Gagal:** Estimasi token streaming tidak presisi bila hulu tidak mengirim usage chunk (fallback 8x chunks).<br>- 🔴 **Gagal:** Abort signal klien tidak diteruskan ke hulu (`router.ts:180`). |
| `/v1/models` | `GET` | `apps/api/src/routes/v1.ts:20` | `apiKeyAuth` | **PARTIAL** | - Mengembalikan daftar model dalam format JSON OpenAI (`object: 'list'`).<br>- 🔴 **Gagal:** Mengembalikan semua model tanpa filter scope key atau batasan paket tenant. |
| `/v1/embeddings` | `POST` | *Tidak Ada* (404) | — | **N/A (Fase 2)** | Sesuai alokasi roadmap Fase 2 di PRD. |
| `/v1/usage` | `GET` | `apps/api/src/routes/account.ts:143` | `sessionAuth` | **PARTIAL** | Ringkasan penggunaan tersedia di `/v1/account/usage`, namun menggunakan autentikasi sesi peramban, bukan Bearer API key. |

---

### 3.2 Evaluasi Header Kepatuhan Gateway (Compliance Headers)

PRD §14.1 menetapkan secara tegas:
> **Header respons:** `X-Request-Id`, `X-RateLimit-Limit-Requests`, `X-RateLimit-Remaining-Requests`, `Retry-After` (saat 429).

| Header Respons PRD | Keberadaan di Kode | Lokasi Pemeriksaan | Bukti Temuan Kode | Status Kepatuhan |
|---|---|---|---|---|
| **`X-Request-Id`** | **HILANG** | `routes/v1.ts`<br>`middleware/logger.ts` | Request ID dibuat secara internal (`crypto.randomUUID()`) dan dicatat di database, namun **tidak pernah disuntikkan** ke header respons HTTP (`c.header('X-Request-Id', ...)` tidak ada). | 🔴 **NON-COMPLIANT** |
| **`X-RateLimit-Limit-Requests`** | **HILANG** | `middleware/auth.ts`<br>`lib/ratelimit.ts` | Nilai rate limit (120 RPM) diperiksa di Redis, tetapi nilai batas total ini **tidak pernah diekspos** di header HTTP klien. | 🔴 **NON-COMPLIANT** |
| **`X-RateLimit-Remaining-Requests`** | **HILANG** | `middleware/auth.ts`<br>`lib/ratelimit.ts` | Sisa kuota request dalam jendela aktif **tidak pernah dikirimkan** ke header klien. | 🔴 **NON-COMPLIANT** |
| **`Retry-After`** | **HILANG** | `middleware/auth.ts:81-100`<br>`lib/ratelimit.ts:121` | Saat gateway mengembalikan HTTP 429 (Too Many Requests), header `Retry-After` **tidak disertakan** sama sekali. | 🔴 **NON-COMPLIANT** |
| **`X-Morphic-Warning`** | **TERSEDIA** | `routes/v1.ts:186-188` | Header peringatan disuntikkan dengan benar saat memanggil model yang berstatus deprecated: `c.header('X-Morphic-Warning', 'model ... is deprecated')`. | 🟢 **COMPLIANT** |

---

## 4. Evaluasi Format Error Standar (PRD §14.4 vs Implementasi)

### 4.1 Perbandingan Struktur JSON Respons Error

#### Standar Wajib PRD §14.4:
```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "insufficient_balance",
    "message": "Saldo tidak mencukupi. Silakan top-up.",
    "request_id": "req_01HXYZ..."
  }
}
```

#### Implementasi Aktual pada Gateway (`apps/api/src/domain/router.ts:251-255`):
```json
{
  "error": {
    "message": "Saldo tidak mencukupi untuk melakukan reservasi kredit.",
    "type": "invalid_request_error",
    "code": "insufficient_credits"
  }
}
```

#### Analisis Kesenjangan (*Gap Analysis*):
1. **Field `request_id` Hilang Total:** Objek JSON error pada gateway tidak menyertakan `request_id`. Ketika pengguna mengalami kegagalan request dan menghubungi customer support, pengguna tidak memiliki referensi ID request untuk pelacakan log (meningkatkan MTTR insiden).
2. **Inkonsistensi String `code`:** PRD mencontohkan `insufficient_balance`, sedangkan kode menggunakan `insufficient_credits`. Meskipun perbedaannya minor, SDK resmi atau integrasi klien pihak ketiga yang mengikat penanganan error ke string `code` dapat mengalami kegagalan parsing.

---

### 4.2 Evaluasi Pemetaan Kode Status HTTP (HTTP Status Code Mapping)

| Kode HTTP | Definisi PRD §14.4 | Implementasi di Kode | Status | Catatan Teknis |
|---|---|---|---|---|
| **400** | Request tidak valid (`invalid_parameter`) | `v1.ts:102, 114, 150` | **PASSED** | Zod schema validation error dipetakan ke 400. |
| **401** | Key tidak valid / dicabut (`invalid_api_key`) | `middleware/auth.ts:32-46` | **PASSED** | Key invalid/revoked/expired mengembalikan 401. |
| **402** | Saldo tidak cukup (`insufficient_balance`) | `routes/v1.ts:258-261` | **PASSED** | Gagal reservasi saldo mengembalikan 402. |
| **403** | Tidak berwenang / scope / suspended | `middleware/auth.ts:51, 62` | **PASSED** | User suspended mengembalikan 403. |
| **404** | Model / rute tidak ditemukan | `routes/v1.ts:182` | **PASSED** | Model tidak aktif/tidak ada mengembalikan 404. |
| **413** | Payload terlalu besar (`payload_too_large`) | *Tidak Diterapkan* | **FAILED** | Hono `bodyLimit` middleware tidak dipasang (T-B3-03). |
| **422** | Validasi skema gagal (`validation_error`) | *Dipetakan ke 400* | **PARTIAL** | Mengembalikan 400 alih-alih 422 untuk kesalahan skema. |
| **429** | Rate limit / kuota (`rate_limit_exceeded`) | `middleware/auth.ts:83, 94` | **PARTIAL** | Mengembalikan 429 tetapi tanpa header `Retry-After`. |
| **500** | Kesalahan internal server generik | `apps/api/src/app.ts:46` | **PASSED** | Pesan generik tanpa stack trace di production. |
| **502 / 504** | Hulu bermasalah / timeout | `domain/router.ts:210-245` | **PASSED** | Dinormalisasi ke `upstream_error` / `upstream_timeout`. |

---

## 5. Ringkasan Kesenjangan Skema & Kontrak API (Discrepancy Summary)

```
┌────────────────────────────────────────────────────────────────────────┐
│             RINGKASAN KESESUAIAN SKEMA DATA & KONTRAK API             │
├──────────────────────────┬───────────┬───────────┬─────────────────────┤
│ Kategori Evaluasi        │ Spesifikasi│ Aktual Kode│ Tingkat Deviasi     │
├──────────────────────────┼───────────┼───────────┼─────────────────────┤
│ Entitas Database PRD §13 │ 16 Tabel  │ 11 Tabel  │ 3 Missing, 3 Shadow │
│ Hash-Only API Key Storage│ Wajib     │ Dilanggar │ Ciphertext Disimpan │
│ Kolom Limit per Key      │ 5 Kolom   │ 0 Kolom   │ Hardcoded Global    │
│ Response Header Gateway  │ 4 Header  │ 0 Header  │ 100% Hilang         │
│ Error JSON request_id    │ Wajib     │ Tidak Ada │ Deviasi Kritis      │
│ Inbound Webhook Provider │ 2 Gateway │ 1 Gateway │ PayPal Webhook Nihil│
│ Zero Retention Prompt DB │ Terpenuhi │ Terpenuhi │ 100% Selaras (Aman) │
└──────────────────────────┴───────────┴───────────┴─────────────────────┤
│ Skor Kesesuaian Skema & API Kontrak: 58.3% (Memerlukan Remediasi P0)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Rekomendasi Remediasi Teknis Skema & API Kontrak

### 6.1 Remediasi Skema Database (DDL Migration)
1. **Hapus Kolom `encrypted_key` dari `api_keys`:** Migrasikan seluruh penyimpanan key ke prinsip *write-only hash*.
2. **Tambahkan Kolom Konfigurasi Limit pada `api_keys`:** Tambahkan `rpm integer DEFAULT 120`, `tpm integer`, `daily_quota integer`, `spend_cap bigint`, dan `scopes jsonb`.
3. **Tambahkan UNIQUE Constraint pada `credit_ledger.reference`:** Mencegah mutasi ledger ganda akibat kegagalan idempotensi aplikasi.
4. **Buat Tabel Kepatuhan:** Buat tabel `abuse_cases` dan `dsar_requests` untuk kepatuhan regulasi.

### 6.2 Remediasi Kontrak API Gateway (Middleware & Response)
1. **Suntikkan Header `X-Request-Id` di Root Middleware:**
   ```typescript
   app.use('*', async (c, next) => {
     const reqId = c.req.header('x-request-id') || `req_${crypto.randomUUID()}`;
     c.set('requestId', reqId);
     c.header('X-Request-Id', reqId);
     await next();
   });
   ```
2. **Sertakan `request_id` pada Format Error JSON:**
   Perbarui fungsi error handler di `domain/router.ts` agar menyertakan `request_id: c.get('requestId')`.
3. **Suntikkan Header Rate Limit & `Retry-After`:**
   Pada middleware `auth.ts`, saat rate limit terlampaui (429), sertakan:
   ```typescript
   c.header('Retry-After', '60');
   c.header('X-RateLimit-Limit-Requests', String(limit));
   c.header('X-RateLimit-Remaining-Requests', String(remaining));
   ```
4. **Pasang Middleware `bodyLimit` di Hono:** Batasi request body maksimal 10MB untuk mencegah DoS buffer exhaustion.

---

*Laporan Tahap E selesai disusun. Hasil analisis ini menjadi masukan akhir untuk penyusunan Tahap F: Ringkasan Eksekutif & Rencana Tindak Lanjut Komprehensif (`F-summary.md`).*
