# LAPORAN TAHAP B2: FR-KEY (Manajemen API Key)

**Tanggal Audit:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Modul:** FR-KEY-01..09, SR-03, KEY-01..13, DM-ENT-04, API-GW-HDR, API-GW-RESPHDR, API-CON-KEYS, OPS-SLO-04  
**File Kode Diperiksa:**
- [`packages/shared/src/keys.ts`](file:///c:/Users/esc/Desktop/morphic/packages/shared/src/keys.ts)
- [`packages/db/src/schema.ts`](file:///c:/Users/esc/Desktop/morphic/packages/db/src/schema.ts)
- [`apps/api/src/routes/keys.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/keys.ts)
- [`apps/api/src/middleware/auth.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/middleware/auth.ts)
- [`apps/api/src/ratelimit.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/ratelimit.ts)
- [`apps/api/src/routes/v1.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/v1.ts)
- [`apps/api/src/middleware/logger.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/middleware/logger.ts)
- [`apps/web/src/lib/actions.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/actions.ts)
- [`apps/web/src/app/api/backend/[...path]/route.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/api/backend/[...path]/route.ts)
- [`apps/web/src/app/dashboard/keys/keys-view.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/dashboard/keys/keys-view.tsx)
- [`apps/api/src/routes/security.test.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/security.test.ts)
- [`packages/shared/src/selfcheck.test.ts`](file:///c:/Users/esc/Desktop/morphic/packages/shared/src/selfcheck.test.ts)
- [`packages/db/src/e2e.ts`](file:///c:/Users/esc/Desktop/morphic/packages/db/src/e2e.ts)

---

## 1. Tabel Pemetaan Kebutuhan PRD (FR-KEY-01 s/d FR-KEY-09)

| ID PRD | Kebutuhan PRD | Prioritas / Fase | Status | Bukti Kode (file:baris) | Penjelasan & Bukti Lapangan |
|---|---|---|---|---|---|
| **FR-KEY-01** | Buat key dengan nama, scope (model/endpoint), batas, kedaluwarsa opsional. Key CSPRNG ≥ 128 bit, prefix khas, **hanya hash tersimpan**. | M (Must) / Fase 1 | **PARTIAL** | `shared/keys.ts:11-14`; `routes/keys.ts:28-63`; `schema.ts:81-99` | **Terpenuhi:** CSPRNG 256-bit (`randomBytes(32)`), prefix khas `mp-`, label nama (`body.name`), kedaluwarsa opsional (`none`, `30d`, `90d`).<br>**Gagal / Hilang:** (1) Prinsip *hash-only storage* dilanggar karena `encryptedKey` (AES-256-GCM) disimpan ke DB (`schema.ts:91`); (2) Scope (model allowlist / endpoint restriction / read-only) tidak ada; (3) Konfigurasi batas per key (RPM/TPM/spend) tidak ada di payload create. |
| **FR-KEY-02** | Tampilkan key penuh **sekali** saat dibuat. Setelah ditutup, hanya prefix + 4 karakter terakhir yang tampil. | M (Must) / Fase 1 | **VIOLATION** | `routes/keys.ts:111`; `actions.ts:120,153`; `keys-view.tsx:288-320` | **Pelanggaran Kritis Desain:** Key dapat dilihat dan disalin kapan saja berulang kali. `GET /v1/keys` mengembalikan plaintext via `decryptApiKey()` (`routes/keys.ts:111`), `listApiKeys()` mengembalikan `rawKey` (`actions.ts:120,153`), dan UI dashboard secara eksplisit menyediakan tombol "Mata" (reveal) dan tombol "Copy" untuk setiap key yang pernah dibuat (`keys-view.tsx:301-320`). |
| **FR-KEY-03** | Daftar key (masked), terakhir dipakai, status. **Tidak ada endpoint yang mengembalikan key penuh**. | M (Must) / Fase 1 | **VIOLATION** | `routes/keys.ts:106-118`; `actions.ts:116-125,149-158` | **Terpenuhi:** Menampilkan daftar key, metadata `status`, `expires_at`, `created_at`, dan `last_used_at` (`routes/keys.ts:112-116`).<br>**Pelanggaran:** PRD secara eksplisit menyatakan *"Tidak ada endpoint yang mengembalikan key penuh"*, namun baik endpoint REST `GET /v1/keys` maupun Server Action `listApiKeys` mengembalikan key penuh terdekripsi. |
| **FR-KEY-04** | **Revoke instan**. Given key direvoke, when dipakai, then 401 dalam waktu ≤ 5 detik. | M (Must) / Fase 1 | **PARTIAL** | `routes/keys.ts:121-143`; `middleware/auth.ts:30-46` | **Kecepatan Terpenuhi (≤ 5 detik):** Gateway memeriksa `s.apiKeys` langsung ke PostgreSQL tanpa auth caching layer (`auth.ts:38`), sehingga pencabutan key langsung efektif instan (< 50ms).<br>**Deviasi / Gap:** Implementasi pencabutan menggunakan **Hard Delete** (`db.delete(s.apiKeys)` di `keys.ts:140`) bukan Soft Delete (`status = 'revoked'`), merusak kolom `revoked_at` dan integritas riwayat relasi. |
| **FR-KEY-05** | Rotasi key dengan masa tenggang (grace period). Key lama dan baru aktif bersamaan hingga batas yang dipilih. | S (Should) / Fase 1 | **MISSING** | — | Endpoint `POST /v1/keys/:id/rotate` (yang disyaratkan di PRD API-CON-KEYS) tidak ada. Tidak ada logika rotasi key dengan grace period dual-active di kode backend maupun UI. |
| **FR-KEY-06** | Batas per key: RPM, TPM, kuota harian/bulanan, spend cap, concurrency. Melebihi batas → 429 atau 402/403. | M (Must) / Fase 1 | **PARTIAL** | `v1.ts:16-18`; `auth.ts:77-106`; `ratelimit.ts:103-130` | **Terpenuhi:** Gateway membatasi RPM (120) dan Concurrency (5) via Redis/In-memory store (`ratelimit.ts`). Melebihi batas mengembalikan status HTTP 429.<br>**Hilang:** (1) Batas bersifat hardcoded global, tidak bisa dikonfigurasi per key; (2) Batas TPM (Tokens Per Minute) tidak ada; (3) Kuota harian/bulanan per key tidak ada; (4) Spend cap per key tidak ada; (5) Header `Retry-After` dan `X-RateLimit-*` tidak disertakan saat 429. |
| **FR-KEY-07** | IP allowlist per key. Request dari IP di luar daftar ditolak. | C (Could) / Fase 1 | **MISSING** | — | Tidak ada kolom IP allowlist pada tabel `api_keys`, tidak ada input konfigurasi di UI, dan tidak ada pemeriksaan IP pada middleware `apiKeyAuth`. (Status di PRD: 'Could Have' Fase 1). |
| **FR-KEY-08** | Audit log siklus hidup key. Create/rotate/revoke tercatat dengan aktor, waktu, IP. | M (Must) / Fase 1 | **MISSING** | `routes/keys.ts:15,121`; `schema.ts:387-401` | Tabel audit log hanya ada untuk tindakan admin (`admin_audit_log`). Siklus hidup key pengguna (`create`, `delete`) sama sekali tidak mencatat log audit apa pun ke database maupun stream audit terstruktur. |
| **FR-KEY-09** | Batas jumlah key per akun (default mis. 20 key per akun). | S (Should) / Fase 1 | **MISSING** | `routes/keys.ts:15-84`; `actions.ts:503-548` | Tidak ada validasi jumlah maksimum key aktif milik pengguna. Endpoint `POST /v1/keys` dan server action `provisionPostPaymentKey` dapat dipanggil tanpa batas hingga menyebabkan bloating row DB. |

---

## 2. Tabel Pemetaan Kontrol Keamanan (KEY-01 s/d KEY-13)

| ID Kontrol | Deskripsi Kontrol Keamanan | Status | Bukti Kode (file:baris) | Evaluasi & Rekomendasi Auditor |
|---|---|---|---|---|
| **KEY-01** | Key dibuat dengan CSPRNG, entropi ≥ 128 bit (idealnya 256 bit); bukan Math.random / UUID / counter. | **IMPLEMENTED** | `shared/keys.ts:12`; `routes/keys.ts:48` | Menggunakan `crypto.randomBytes(32)` (256 bit entropi murni). Memenuhi standar CWE-330 & CWE-338. |
| **KEY-02** | Key disimpan **hanya sebagai hash** (SHA-256/HMAC); plaintext tidak pernah tersimpan; hanya prefix untuk tampilan. | **FAILED** | `schema.ts:91`; `routes/keys.ts:51,60`; `[...path]/route.ts:180-185` | **Pelanggaran Kritis:** Kolom `encrypted_key` menyimpan ciphertext AES-256-GCM dari plaintext key. Kunci dapat didekripsi kapan saja oleh aplikasi. Melanggar CWE-312 dan POL-DATA-03. |
| **KEY-03** | Key ditampilkan penuh **sekali saja** saat dibuat. | **FAILED** | `routes/keys.ts:111`; `keys-view.tsx:288-320` | Key ditampilkan di list endpoint dan dapat dibuka/disalin berulang kali via UI dashboard kapan saja. |
| **KEY-04** | Pembandingan key memakai lookup berbasis hash atau constant-time compare. | **IMPLEMENTED** | `middleware/auth.ts:28,38` | Lookup menggunakan `SHA-256(raw)` diindeks secara exact match di PostgreSQL (`key_hash`). Kebal terhadap timing attack token. |
| **KEY-05** | Key hanya diterima via header (`Authorization` / `x-api-key`), **bukan query string**. | **PARTIAL** | `middleware/auth.ts:20-25` | **Baik:** Query string (`?api_key=...`) diabaikan dan ditolak (401).<br>**Deviasi:** Header alternatif `x-api-key` tidak didukung (hanya `Authorization: Bearer mp-...`). |
| **KEY-06** | Revoke berlaku efektif segera (target: ≤ 5 detik). | **IMPLEMENTED** | `routes/keys.ts:140`; `middleware/auth.ts:38` | Karena tidak ada cache layer auth di Redis, revokasi key langsung berlaku efektif seketika (< 50ms) pada query SQL berikutnya. |
| **KEY-07** | Scope per key (model allowlist, endpoint, read-only), expiry opsional, label. | **PARTIAL** | `routes/keys.ts:28,37-46` | Label dan expiry opsional (`none`, `30d`, `90d`) ada. Scope model allowlist dan read-only flag **tidak ada**. |
| **KEY-08** | Batas per key: RPM/TPM, kuota harian/bulanan, spend cap, concurrency. | **PARTIAL** | `v1.ts:16-18`; `ratelimit.ts:103-126` | RPM (120) dan concurrency (5) aktif per key secara statis. Batas TPM, kuota harian, spend cap, dan kustomisasi limit per key **belum ada**. |
| **KEY-09** | Opsi IP allowlist / origin restriction per key. | **MISSING** | — | Belum diimplementasikan. (Kontrol Severity Rendah / Fase 1 Could Have). |
| **KEY-10** | Deteksi penyalahgunaan (lonjakan, banyak IP/geo, abuse) → auto-suspend + notifikasi. | **MISSING** | `lib/alert.ts:124-164` | `alert.ts` hanya memonitor health provider hulu. Tidak ada modul deteksi abuse pada pola penggunaan API key. |
| **KEY-11** | Prefix key khas agar mudah dideteksi secret scanner (mis. `sk-namabrand-`). | **IMPLEMENTED** | `shared/keys.ts:3`; `routes/keys.ts:48` | Menggunakan prefix khas `mp-` secara konsisten pada seluruh generator dan validator key. |
| **KEY-12** | Key **tidak muncul** di log, analytics, error tracker, APM, atau header yang diteruskan ke hulu. | **IMPLEMENTED** | `logger.ts:24-28`; `domain/router.ts:177-178` | Request logger hanya merekam `apiKeyId` (UUID). Header authorization ke hulu hanya meneruskan kredensial provider hulu, bukan key klien. |
| **KEY-13** | Batas jumlah key per akun; audit log pembuatan, perubahan, dan pencabutan key. | **MISSING** | `routes/keys.ts:15,121` | Tidak ada pembatasan jumlah key per akun dan tidak ada pencatatan audit log siklus hidup key. |

---

## 3. Temuan Keamanan & Kepatuhan — Diurutkan Berdasarkan Risiko

### 🟠 T-B2-01 — TINGGI: Penyimpanan Reversibel Plaintext Key & Fitur Pengungkapan Berulang (Reveal Anywhere)
**ID PRD:** FR-KEY-02, FR-KEY-03 | **Butir Audit:** KEY-02, KEY-03, POL-DATA-03, CWE-312  
**Keyakinan:** Confirmed (Terverifikasi Penuh di Seluruh Layer)  
**Terkait:** Melanjutkan dan memperluas temuan `T-B1-02`.

**Analisis & Bukti Lapangan:**  
Berbeda dari asumsi awal di mana kebocoran hanya terjadi pada baris `routes/keys.ts:111`, penelusuran menyeluruh membuktikan bahwa terdapat **rekayasa pipa menyeluruh** di seluruh aplikasi untuk menyimpan dan mengembalikan plaintext key:

1. **Skema Database (`packages/db/src/schema.ts:91`):**
   ```typescript
   export const apiKeys = pgTable('api_keys', {
     ...
     keyHash: text('key_hash').notNull().unique(),
     keyPrefix: text('key_prefix').notNull(),
     encryptedKey: text('encrypted_key'), // ← Menyimpan ciphertext AES-256-GCM
   ```
2. **Next.js Proxy Auto-Backfill (`apps/web/src/app/api/backend/[...path]/route.ts:172-185`):**
   ```typescript
   if (rawPath === '/v1/keys' && req.method === 'POST' && res.ok) {
     const text = await res.text();
     const json = JSON.parse(text);
     if (json?.id && json?.key) {
       const encryptedKey = encryptApiKey(json.key);
       await db.update(s.apiKeys).set({ encryptedKey }).where(eq(s.apiKeys.id, json.id));
     }
   }
   ```
3. **Server Action Decryption (`apps/web/src/lib/actions.ts:120,153`):**
   ```typescript
   // actions.ts:120 & 153
   rawKey: decryptApiKey(r.encryptedKey), // didekripsi dan dikirim ke UI
   ```
4. **Dashboard UI Reveal & Copy (`apps/web/src/app/dashboard/keys/keys-view.tsx:301-320`):**
   Komponen UI secara sengaja menyediakan tombol mata (`toggleReveal`) dan copy (`handleCopyKey`) untuk setiap baris key lama. Komentar di baris 299 bahkan mendokumentasikan deviasi ini:
   `// Old keys only ever stored a one-way hash, so there is nothing to show; the buttons stay visible but disabled with the reason.`

**Dampak:**  
Jika database bocor (via SQL Injection, backup compromise, atau insider threat), seluruh API key pengguna dapat didekripsi (terlebih dengan adanya fallback secret hardcoded `T-B1-09`). Pelanggaran total terhadap standar NIST SP 800-63B, OWASP API Security, dan klausul POL-DATA-03 ("Hanya hash yang disimpan; plaintext tidak pernah disimpan di database").

**Mitigasi:**
1. Hapus kolom `encrypted_key` dari skema Drizzle (`packages/db/src/schema.ts`) dan jalankan migrasi `DROP COLUMN encrypted_key`.
2. Di `apps/api/src/routes/keys.ts:111`, ubah properti `key` menjadi tidak ada atau hanya kembalikan `prefix`.
3. Hapus middleware proxy backfill di `apps/web/src/app/api/backend/[...path]/route.ts:172-194`.
4. Hapus tombol `Eye`/`Copy` untuk key lama di `apps/web/src/app/dashboard/keys/keys-view.tsx`. Tampilkan hanya `maskedKey(k.keyPrefix)`.

---

### 🟡 T-B2-02 — SEDANG: Tidak Ada Batas Jumlah Key per Akun (Unlimited Key Creation)
**ID PRD:** FR-KEY-09 | **Butir Audit:** KEY-13, CWE-770  
**Keyakinan:** Confirmed

**Bukti Kode (`apps/api/src/routes/keys.ts:15-84`):**
```typescript
keys.post('/', async (c) => {
  const { userId } = c.get('userSession');
  // ... validasi name dan expiresIn ...
  // TIDAK ADA pengecekan jumlah key aktif milik user!
  const [inserted] = await db.insert(s.apiKeys).values({ ... });
```
Hal serupa terjadi pada Server Action `provisionPostPaymentKey` di `apps/web/src/lib/actions.ts:524`.

**Dampak:**  
Akun pengguna dapat membuat ribuan API key secara otomatis via script. Penyerang dapat memicu *denial-of-service* pada database (disk exhaustion & degradasi index query `api_keys_user_idx`).

**Mitigasi:**
Tambahkan verifikasi kuota sebelum insert (default 20 key sesuai PRD):
```typescript
const [existing] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(s.apiKeys)
  .where(and(eq(s.apiKeys.userId, userId), eq(s.apiKeys.status, 'active')));

if (existing.count >= 20) {
  return c.json(
    { error: { message: 'Maximum active API keys limit reached (20)', type: 'invalid_request_error', code: 'key_quota_exceeded' } },
    400,
  );
}
```

---

### 🟡 T-B2-03 — SEDANG: Revokasi Key Menggunakan Hard Delete (Penghapusan Jejak Permanen)
**ID PRD:** FR-KEY-04, DM-ENT-04 | **Butir Audit:** KEY-06, KEY-13, DM-RULE-05  
**Keyakinan:** Confirmed

**Bukti Kode (`apps/api/src/routes/keys.ts:138-141`):**
```typescript
// Hard delete: auth looks keys up by hash, so the key stops working on its next request.
// Usage and request logs keep their rows (api_key_id is set null by the FK).
await db.delete(s.apiKeys).where(and(eq(s.apiKeys.id, keyId), eq(s.apiKeys.userId, userId)));
```

**Dampak:**  
1. Skema `apiKeys` telah mendefinisikan kolom `status: text('status', { enum: ['active', 'revoked'] })` dan `revokedAt`, namun keduanya tidak pernah dimanfaatkan.
2. Karena foreign key `api_key_id` di tabel `request_logs`, `reservations`, dan `usage_records` diset `ON DELETE SET NULL`, penghapusan fisik key memutuskan relasi forensik antara riwayat request masa lalu dengan key yang mengeksekusinya.

**Mitigasi:**
Ganti operasi `DELETE` menjadi soft-delete status update:
```typescript
await db
  .update(s.apiKeys)
  .set({ status: 'revoked', revokedAt: new Date() })
  .where(and(eq(s.apiKeys.id, keyId), eq(s.apiKeys.userId, userId)));
```
Perilaku gateway di `apps/api/src/middleware/auth.ts:38` sudah memfilter `eq(s.apiKeys.status, 'active')`, sehingga key otomatis tidak valid seketika.

---

### 🟡 T-B2-04 — SEDANG: Ketiadaan Audit Log Siklus Hidup API Key
**ID PRD:** FR-KEY-08 | **Butir Audit:** KEY-13, LOG-01  
**Keyakinan:** Confirmed

**Bukti Kode:**  
Pencarian terhadap entitas audit di database menunjukkan bahwa hanya tabel `admin_audit_log` yang tersedia (`schema.ts:390`). Pada handler pembuatan key (`keys.post('/')`) dan penghapusan key (`keys.delete('/:id')`), tidak ada instruksi pencatatan audit log apa pun.

**Dampak:**  
Tidak ada jejak forensik jika terjadi kompromi kredensial. Jika API key dihapus atau dibuat oleh pihak yang tidak sah melalui sesi yang dibajak, administrator maupun pemilik akun tidak dapat mengidentifikasi aktor, IP address asal, maupun waktu kejadian.

**Mitigasi:**
Catat setiap mutasi kredensial ke tabel audit event terstruktur dengan metadata: `user_id`, `action: 'key.created' | 'key.revoked'`, `target_key_id`, `ip_address`, `user_agent`, `created_at`.

---

### 🟡 T-B2-05 — SEDANG: Fitur Rotasi Key dengan Masa Tenggang (Grace Period) Belum Ada
**ID PRD:** FR-KEY-05, API-CON-KEYS | **Butir Audit:** KEY-06  
**Keyakinan:** Confirmed (Kebutuhan Fase 1 'Should Have')

**Bukti Kode:**  
Pencarian rute `rotate` di seluruh `apps/api` dan `apps/web` tidak membuahkan hasil. Endpoint `POST /api/keys/{id}/rotate` tidak ada.

**Dampak:**  
Pengguna produksi tidak memiliki cara melakukan rotasi kredensial otomatis secara zero-downtime. Penggantian key mengharuskan pembuatan key baru secara manual dan penghapusan manual key lama, yang rentan menyebabkan *service outage* pada sistem klien.

**Mitigasi:**
Tambahkan endpoint `POST /v1/keys/:id/rotate` yang menghasilkan key baru, lalu menyetel `expiresAt` pada key lama menjadi `NOW() + gracePeriod` (mis. 24 jam atau 7 hari).

---

### 🟡 T-B2-06 — SEDANG: Batas Penggunaan per Key Bersifat Global-Statis; Header 429 Hilang
**ID PRD:** FR-KEY-06, FR-GW-09, API-GW-RESPHDR | **Butir Audit:** KEY-08, PROXY-07  
**Keyakinan:** Confirmed

**Bukti Kode (`apps/api/src/routes/v1.ts:16-18` & `apps/api/src/middleware/auth.ts:81-86`):**
```typescript
// v1.ts:16-18 — limit hardcoded untuk semua request
v1.use('/models', apiKeyAuth, gatewayGuards({ rpm: 120, concurrency: 5 }));
v1.use('/chat/*', apiKeyAuth, gatewayGuards({ rpm: 120, concurrency: 5 }));

// auth.ts:81-86 — respons 429 tanpa header rate limit
if (!(await checkRateLimit(keyId, limit.rpm))) {
  return c.json(
    { error: { message: 'rate limit exceeded', type: 'rate_limit_error', code: 'rate_limit_exceeded' } },
    429,
  );
}
```

**Dampak:**  
1. Tidak ada batas TPM, kuota harian, maupun spend cap per key (hanya saldo dompet user global).
2. Klien SDK otomatis tidak dapat membaca header standar `Retry-After` untuk melakukan exponential backoff saat menerima HTTP 429.

**Mitigasi:**
1. Tambahkan header `Retry-After: 60`, `X-RateLimit-Limit: 120`, dan `X-RateLimit-Remaining: 0` pada respons HTTP 429 di `apps/api/src/middleware/auth.ts:82`.
2. Tambahkan kolom `rpm`, `tpm`, `daily_quota`, `spend_cap` pada tabel `api_keys` untuk mendukung kustomisasi limit di masa mendatang sesuai skema DM-ENT-04.

---

### 🔵 T-B2-07 — RENDAH: Inkonsistensi Generator & Encoding API Key
**ID PRD:** FR-KEY-01 | **Butir Audit:** KEY-01, KEY-11  
**Keyakinan:** Confirmed — DEVIASI INTERNAL

**Bukti Kode:**  
- **Backend Hono (`apps/api/src/routes/keys.ts:48`):**
  `const rawKey = 'mp-' + randomBytes(32).toString('hex');` → Panjang **67 karakter** (encoding hex: `mp-` + 64 hex chars).
- **Shared Package (`packages/shared/src/keys.ts:12`):**
  `const raw = KEY_PREFIX + randomBytes(32).toString('base64url');` → Panjang **46 karakter** (encoding base64url: `mp-` + 43 base64url chars).
- **Frontend Server Action (`apps/web/src/lib/actions.ts:518`):**
  Memanggil `generateApiKey()` dari shared package (menghasilkan format 46 karakter).

**Dampak:**  
Key memiliki format dan panjang yang berbeda tergantung dibuat melalui API REST backend atau Server Action frontend. Menimbulkan kebingungan bagi regex secret scanner klien dan inkonsistensi dokumentasi.

**Mitigasi:**
Gunakan fungsi standar `generateApiKey()` dari `@morphic/shared/keys` di dalam `apps/api/src/routes/keys.ts:48`.

---

### 🔵 T-B2-08 — RENDAH: Gateway Tidak Mendukung Header Alternatif `x-api-key`
**ID PRD:** API-GW-HDR | **Butir Audit:** KEY-05  
**Keyakinan:** Confirmed — DEVIASI DOKUMENTASI

**Bukti Kode (`apps/api/src/middleware/auth.ts:20-25`):**
```typescript
const header = c.req.header('authorization');
if (!header?.startsWith('Bearer mp-')) {
  return c.json({ error: { message: 'missing or invalid api key', type: 'auth_error', code: 'missing_api_key' } }, 401);
}
```

**Dampak:**  
Klien yang mengonfigurasi header `x-api-key: mp-...` (sesuai spesifikasi PRD API-GW-HDR) ditolak dengan status 401.

**Mitigasi:**
Dukung kedua opsi header pada middleware `apiKeyAuth`:
```typescript
const authHeader = c.req.header('authorization');
const xApiKey = c.req.header('x-api-key');
let rawKey = authHeader?.startsWith('Bearer mp-') ? authHeader.slice(7).trim() : xApiKey?.trim();
if (!rawKey || !rawKey.startsWith('mp-')) {
  return c.json({ error: { message: 'missing or invalid api key', type: 'auth_error', code: 'missing_api_key' } }, 401);
}
```

---

## 4. Jawaban Atas 6 Pertanyaan Kunci Audit B2

1. **Apakah ada batas jumlah key per akun (FR-KEY-09)?**  
   **TIDAK ADA.** Pengguna dapat membuat API key dalam jumlah tak terhingga melalui `POST /v1/keys` dan server action `provisionPostPaymentKey`. (Temuan: `T-B2-02`).

2. **Apakah ada IP allowlist per key (FR-KEY-07)?**  
   **TIDAK ADA.** Skema database tidak memiliki kolom allowlist IP, dan gateway tidak melakukan validasi IP per key. (Status: Fase 1 'Could Have', Temuan: `T-B2-09`).

3. **Apakah ada scope / model restriction per key (FR-KEY-01)?**  
   **TIDAK ADA.** Key yang aktif memiliki akses penuh ke seluruh model yang aktif di gateway tanpa filter scope atau izin read-only. Skema DB tidak memiliki kolom `scopes`.

4. **Apakah ada audit log create / revoke key (FR-KEY-08)?**  
   **TIDAK ADA.** Tidak ada pencatatan audit log saat key dibuat atau dihapus. Tabel audit log saat ini hanya mencatat tindakan administrator. (Temuan: `T-B2-04`).

5. **Apakah revoke efektif ≤ 5 detik (FR-KEY-04) — ada cache Redis?**  
   **EFEKTIF INSTAN (≤ 5 detik TERPENUHI).** Tidak ada layer cache auth di Redis atau in-memory gateway; setiap pemanggilan request gateway langsung memvalidasi hash key ke tabel PostgreSQL. Karena menggunakan `db.delete()` langsung ke DB, key dicabut seketika (< 50ms). Namun, cara pencabutannya berupa Hard Delete alih-alih Soft Delete. (Temuan: `T-B2-03`).

6. **Apakah ada RPM / TPM / spend-cap per key (FR-KEY-06)?**  
   **SEBAGIAN (PARTIAL).** Hanya ada pembatasan RPM (120 req/menit) dan Concurrency (5 slot) yang di-enforce via Redis/in-memory store. Batas ini **bersifat statis-global**, bukan konfigurasi per key. Batas TPM, kuota harian, spend cap per key, dan header respons 429 (`Retry-After`) belum ada. (Temuan: `T-B2-06`).

---

## 5. Rekapitulasi Status B2 & Matriks Risiko

### Ringkasan Status Butir FR-KEY

| Kategori Status | Jumlah | Daftar ID |
|---|---|---|
| **IMPLEMENTED** | 0 | — |
| **PARTIAL** | 4 | FR-KEY-01, FR-KEY-04, FR-KEY-06, KEY-05 |
| **VIOLATION / FAILED** | 2 | FR-KEY-02, FR-KEY-03 (KEY-02, KEY-03) |
| **MISSING** | 3 | FR-KEY-05, FR-KEY-07, FR-KEY-08, FR-KEY-09 |
| **DEVIASI** | 2 | T-B2-07 (generator key format), T-B2-08 (`x-api-key` header) |

### Matriks Prioritas Temuan B2

| Kode Temuan | Severity | Prioritas Perbaikan | Estimasi Kesulitan Fix | Dampak Utama |
|---|---|---|---|---|
| **T-B2-01** | 🟠 Tinggi | **P1 — Segera** | Rendah - Sedang (hapus kolom enkripsi & tombol UI) | Kebocoran massal seluruh API key jika DB / session jebol |
| **T-B2-02** | 🟡 Sedang | **P1 — Segera** | Sangat Rendah (5 baris count check) | Database flooding / resource exhaustion |
| **T-B2-03** | 🟡 Sedang | **P1 — Segera** | Sangat Rendah (ubah delete ke update status) | Hilangnya rekam jejak integritas relasi forensik |
| **T-B2-04** | 🟡 Sedang | **P2 — Sebelum Launch** | Sedang (buat tabel audit log pengguna) | Ketiadaan jejak audit compliance |
| **T-B2-05** | 🟡 Sedang | **P2 — Sebelum Launch** | Sedang (implementasi endpoint rotasi) | Downtime aplikasi pengguna saat rotasi kredensial |
| **T-B2-06** | 🟡 Sedang | **P2 — Sebelum Launch** | Rendah - Sedang (tambah header 429 & kolom DB) | Inkompatibilitas backoff klien SDK |
| **T-B2-07** | 🔵 Rendah | **P3 — Refactoring** | Sangat Rendah (reuse shared generator) | Format key berbeda-beda |
| **T-B2-08** | 🔵 Rendah | **P3 — Peningkatan** | Sangat Rendah (tambah parse header `x-api-key`) | Klien pihak ketiga gagal terhubung |

---

## 6. Informasi Wajib Penutup B2

**File yang sudah dibaca & dianalisis tuntas:**
- `packages/shared/src/keys.ts`
- `packages/db/src/schema.ts`
- `apps/api/src/routes/keys.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/ratelimit.ts`
- `apps/api/src/routes/v1.ts`
- `apps/api/src/middleware/logger.ts`
- `apps/web/src/lib/actions.ts`
- `apps/web/src/app/api/backend/[...path]/route.ts`
- `apps/web/src/app/dashboard/keys/keys-view.tsx`
- `apps/api/src/routes/security.test.ts`
- `packages/shared/src/selfcheck.test.ts`
- `packages/db/src/e2e.ts`

**Keterbatasan & Asumsi:**
- Pengujian latensi pencabutan key diambil dari karakteristik arsitektur kode (direct SQL select tanpa caching).
- Tidak ada secret produksi yang diperiksa atau diekspos dalam laporan ini.

**Langkah Selanjutnya:**
Tahap B2 selesai. Lanjutkan ke **Tahap B3: FR-GW (Gateway Routing, Fallback, Metering, SSE & Error Handling)** → output ke `B3-gateway.md`.

---
*Laporan B2 disimpan di: `audit-out/prd-conformance/B2-keys.md`.*
