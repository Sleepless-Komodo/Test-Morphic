# LAPORAN TAHAP B1: FR-AUTH + FR-AUTHZ (Autentikasi & Otorisasi)

**Tanggal Audit:** 4 Oktober 2026 (diperbarui: pencabutan T-B1-04)
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)
**Modul:** FR-AUTH-01..08, FR-ADM-01..03 & 07, SR-02, SR-04
**File Kode Diperiksa:**
- [`apps/web/src/lib/auth.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/auth.ts)
- [`apps/web/src/app/login/email/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/login/email/page.tsx)
- [`apps/web/src/lib/actions.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/actions.ts)
- [`apps/web/src/lib/admin-actions.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/admin-actions.ts)
- [`apps/web/src/app/admin/layout.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/layout.tsx)
- [`apps/api/src/middleware/session-auth.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/middleware/session-auth.ts)
- [`apps/api/src/middleware/auth.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/middleware/auth.ts)
- [`apps/api/src/routes/keys.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/keys.ts)
- [`packages/db/src/schema.ts`](file:///c:/Users/esc/Desktop/morphic/packages/db/src/schema.ts)
- [`packages/shared/src/keys.ts`](file:///c:/Users/esc/Desktop/morphic/packages/shared/src/keys.ts)
- [`packages/shared/src/provider-crypto.ts`](file:///c:/Users/esc/Desktop/morphic/packages/shared/src/provider-crypto.ts)
- [`.env.example`](file:///c:/Users/esc/Desktop/morphic/.env.example) — dikonfirmasi hanya placeholder; tidak di-push ke git

---

## 1. Tabel Pemetaan FR-AUTH

| ID | Kebutuhan PRD | Status | Bukti (file:baris) | Penjelasan |
|---|---|---|---|---|
| **FR-AUTH-01** | Registrasi email + verifikasi + CAPTCHA; akun nonaktif sampai verifikasi; rate limit | **PARTIAL** | `auth.ts:24,51-58`; `login/email/page.tsx:36-69` | Ada: `email_verified` di DB; Better Auth handle verifikasi; CAPTCHA via plugin kondisional; rate limit `window:60 max:20`. Gap: (1) `autoSignIn: true` pada `emailAndPassword` memungkinkan akses langsung pasca-register sebelum verifikasi email dikonfirmasi; (2) CAPTCHA opsional dikendalikan env — tidak ada enforcement wajib di production. |
| **FR-AUTH-02** | Login + MFA/TOTP; MFA **wajib** untuk admin | **MISSING** | — | Tidak ada satu pun referensi `twoFactor`, `totp`, `mfa` di kodebase. Plugin `twoFactor` Better Auth tidak di-enable di `auth.ts:50`. Admin login hanya butuh email+password. |
| **FR-AUTH-03** | Reset password aman: token sekali-pakai ≤ 30 mnt; respons seragam | **PARTIAL** | `auth.ts:60-107`; tidak ada `/forgot` `/reset` di `apps/web/src/app` | Ada: tabel `verifications` menampung token dengan `expires_at`. Gap: Tidak ada halaman UI forgot/reset ditemukan di frontend; TTL 30 menit TDV (tergantung konfigurasi Better Auth internal). |
| **FR-AUTH-04** | Hash Argon2id/bcrypt; tidak pernah plaintext | **PARTIAL/TDV** | `auth.ts:80-84`; `schema.ts:65` | Better Auth `^1.3.0` menggunakan **scrypt** sebagai default (bukan Argon2id maupun bcrypt) — DEVIASI terminologi PRD meski scrypt sendiri kuat. Tidak ditemukan password plaintext di kode. TDV: Perlu konfirmasi konfigurasi hash algorithm Better Auth. |
| **FR-AUTH-05** | Manajemen sesi: daftar sesi, logout semua; ganti password → akhiri sesi lain | **PARTIAL** | `actions.ts:238-248`; `settings-view.tsx:9,141` | Ada: `revokeOtherSessions()`, `revokeSessionById()`, tampilan sesi aktif. Gap: Keterkaitan antara perubahan password dan revokasi sesi otomatis tidak dikonfirmasi dari kode — bergantung perilaku bawaan Better Auth. |
| **FR-AUTH-06** | Hapus akun dan ekspor data | **PARTIAL** | `actions.ts:550-572` | Ada: `deleteOwnAccount()` dengan konfirmasi email dan CASCADE DB delete. Gap: (1) CASCADE menghapus data keuangan secara permanen — melanggar DM-RULE-05; (2) Konfirmasi hanya berupa string match email, bukan re-authentication password; (3) Fitur ekspor DSAR belum ada. |
| **FR-AUTH-07** | SSO Google/GitHub/SAML (Fase 3) | **PARTIAL** | `auth.ts:85-94` | Google & GitHub OAuth dikonfigurasi. SAML sesuai Fase 3. TDV: Validasi PKCE dan exact-match redirect URI bergantung pada konfigurasi di provider dashboard. |
| **FR-AUTH-08** | Org/tim + RBAC multi-peran (Fase 3) | **MISSING (wajar)** | — | Tidak ada entitas `organizations`/`memberships` — sesuai Fase 3. |

---

## 2. Tabel Pemetaan FR-ADM (Otorisasi Admin)

| ID | Kebutuhan PRD | Status | Bukti (file:baris) | Penjelasan |
|---|---|---|---|---|
| **FR-ADM-01** | RBAC admin + MFA wajib + IP allowlist | **PARTIAL** | `admin/layout.tsx:5`; `actions.ts:51-73` | Ada: `requireAdmin()` memvalidasi `role === 'admin'` langsung dari DB, menolak sesi API-key dan akun suspended — desain baik. Gap: MFA wajib tidak ada; IP allowlist tidak ada; RBAC sub-peran tidak ada. |
| **FR-ADM-02** | Manajemen user: suspend/blokir/ubah plan + audit log | **IMPLEMENTED** | `admin-actions.ts:30-77` | `toggleUserSuspension()` + `deleteUserByAdmin()` dengan `audit()` call. Semua memanggil `requireAdmin()` terlebih dahulu. |
| **FR-ADM-03** | Pool key hulu tanpa tampilkan nilai | **PARTIAL** | `admin-actions.ts:107-160`; `provider-crypto.ts` | Credential disimpan terenkripsi AES-256-GCM. Gap: Form `saveProvider` menerima credential plaintext via `formData` — perlu verifikasi UI tidak me-render `encryptedCredentials` yang ada ke dalam form value. |
| **FR-ADM-07** | Penampil audit log — tidak dapat diubah dari UI | **PARTIAL/TDV** | `schema.ts:389-401` | Tabel `adminAuditLog` ada. Tidak ada mekanisme tamper-evident (hash chain). TDV: Perlu verifikasi apakah halaman `/admin/audit` hanya read-only (direktori `/admin/audit` terdeteksi). |

---

## 3. Temuan Keamanan — Diurutkan Berdasarkan Risiko

### 🔴 T-B1-01 — KRITIS: MFA Tidak Diimplementasikan
**ID PRD:** FR-AUTH-02, FR-ADM-01 | **Butir audit:** AUTH-03, FE-04
**Keyakinan:** Confirmed

Plugin `twoFactor` Better Auth **tidak ada** di `authPlugins[]` (`auth.ts:50`). Admin dan pengguna biasa hanya butuh email+password untuk masuk.

**Dampak:** Akun admin dapat dikompromikan via credential stuffing, phishing, atau brute-force. Satu akun admin yang bocor memberikan akses penuh ke seluruh panel operasional.

**Mitigasi Cepat (tanpa ubah logika bisnis):**
```typescript
// apps/web/src/lib/auth.ts
import { twoFactor } from 'better-auth/plugins';

const authPlugins: any[] = [];
// Tambahkan plugin twoFactor
authPlugins.push(twoFactor({
  issuer: 'Morphic', // nama platform di authenticator app
}));
if (process.env.RECAPTCHA_SECRET_KEY) {
  authPlugins.push(captcha({ ... }));
}
```
Kemudian tambahkan middleware yang menolak admin login tanpa MFA aktif. Migrasi DB: tambahkan kolom `twoFactorEnabled` dan `twoFactorSecret` (Better Auth generate migration-nya).

---

### 🟠 T-B1-02 — TINGGI: Key Plaintext Dikembalikan di Endpoint List
**ID PRD:** FR-KEY-02, FR-KEY-03 | **Butir audit:** KEY-03
**Keyakinan:** Confirmed

```typescript
// apps/api/src/routes/keys.ts:111 — MASALAH
key: decryptApiKey(k.encryptedKey),  // ← plaintext dikembalikan setiap GET /v1/keys
```

Setiap pemanggilan `GET /v1/keys` mengembalikan plaintext key untuk SEMUA key pengguna. PRD menyatakan key hanya ditampilkan **sekali** saat dibuat.

**Dampak:** Jika session token bocor atau ada BOLA/IDOR, seluruh key plaintext bisa diambil. Melanggar prinsip "displayed once".

**Mitigasi Cepat:**
```typescript
// Ganti di keys.ts:111
key: null,  // hapus field ini dari list response

// Atau tampilkan hanya prefix saja:
// key_prefix: k.prefix,
```
Key plaintext sudah tersimpan `encryptedKey` di DB untuk keperluan "recovery" — pertimbangkan apakah fitur itu memang diinginkan atau lebih baik dihapus sama sekali.

---

### 🟠 T-B1-03 — TINGGI: CAPTCHA Opsional Tanpa Enforcement di Production
**ID PRD:** FR-AUTH-01 | **Butir audit:** AUTH-09
**Keyakinan:** Confirmed

```typescript
// auth.ts:51 — CAPTCHA hanya aktif jika env var di-set
if (process.env.RECAPTCHA_SECRET_KEY) {
  authPlugins.push(captcha({ ... }));
}
```

Jika `RECAPTCHA_SECRET_KEY` tidak di-set di production, registrasi massal bot tidak terhambat.

**Mitigasi Cepat:** Tambahkan validasi startup:
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.RECAPTCHA_SECRET_KEY) {
  console.error('[SECURITY] RECAPTCHA_SECRET_KEY wajib di production!');
  // atau throw new Error(...) untuk fail-fast
}
```

---

### 🟡 T-B1-05 — SEDANG: Hapus Akun Menghapus Rekam Keuangan Permanen
**ID PRD:** FR-AUTH-06, DM-RULE-05 | **Butir audit:** DATA-05, BILL-13
**Keyakinan:** Confirmed

```typescript
// actions.ts:563
await db.delete(s.users).where(eq(s.users.id, user.id));
// FK CASCADE → payments, creditLedger, usageRecords terhapus permanen
```

PRD DM-RULE-05: "soft-delete untuk entitas keuangan, hapus fisik hanya data pribadi sesuai kebijakan."

**Mitigasi Cepat (dua langkah):**
1. Tambahkan kolom `deletedAt` di `users` dan ubah ke soft-delete.
2. Pisahkan penghapusan: anonimkan `email/name`, pertahankan baris keuangan, hapus hanya data PII (sesuai UU PDP).

---

### 🟡 T-B1-06 — SEDANG: Tidak Ada UI Reset Password
**ID PRD:** FR-AUTH-03 | **Keyakinan:** Probable

Tidak ditemukan halaman `/password/forgot` atau `/password/reset` di `apps/web/src/app`. Better Auth API mendukung, tapi tanpa UI pengguna tidak dapat melakukan self-service reset.

**Mitigasi Cepat:** Buat halaman minimal `app/password/forgot/page.tsx` yang memanggil `auth.api.forgetPassword()` dan `app/password/reset/page.tsx` yang memanggil `auth.api.resetPassword()`.

---

### 🟡 T-B1-07 — SEDANG: Kolom `tos_version`/`aup_version` Tidak Ada di Tabel `users`
**ID PRD:** FR-ABU-04, DM-ENT-01 | **Butir audit:** AI-08
**Keyakinan:** Confirmed — DEVIASI

Skema DB tidak memiliki kolom `tos_version` maupun `aup_version` di tabel `users`. Versi ToS/AUP yang disetujui tidak direkam per pengguna.

**Keputusan untuk pemilik produk:** Apakah kolom ini ditambahkan ke skema DB (ubah kode) atau PRD direvisi untuk menghapus requirement ini?

**Mitigasi Cepat jika memilih tambah ke kode:**
```sql
ALTER TABLE users ADD COLUMN tos_version text;
ALTER TABLE users ADD COLUMN aup_version text;
```
Isi saat registrasi dengan versi string yang berlaku, mis. `'2026-10-v1'`.

---

### 🟡 T-B1-09 — SEDANG: Hardcoded Fallback Key Enkripsi
**ID PRD:** SR-01 | **Butir audit:** SEC-01
**Keyakinan:** Confirmed

```typescript
// packages/shared/src/keys.ts:35 — SECRET DI KODE
'morphic-secret-salt-default-key-32b'
```

Jika `KEY_ENCRYPTION_SECRET`, `BETTER_AUTH_SECRET`, dan `PROVIDER_ENC_KEY` semua tidak di-set, kunci enkripsi AES untuk API key pengguna adalah string hardcoded yang mudah ditebak.

**Mitigasi Cepat:**
```typescript
function getEncryptionKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.PROVIDER_ENC_KEY;
  if (!secret) {
    throw new Error('[FATAL SECURITY] KEY_ENCRYPTION_SECRET must be set');
  }
  return createHash('sha256').update(secret).digest();
}
```

---

## 4. Rekapitulasi Status

| Status | Jumlah | ID |
|---|---|---|
| **IMPLEMENTED** | 1 | FR-ADM-02 |
| **PARTIAL** | 8 | FR-AUTH-01,03,04,05,06,07; FR-ADM-01,03 |
| **MISSING** | 2 | FR-AUTH-02 (Kritis), FR-AUTH-08 (wajar Fase 3) |
| **DEVIASI** | 2 | T-B1-07 (tos_version), T-B1-08 (hash algo) |
| **TDV** | 2 | FR-AUTH-07 PKCE, FR-ADM-07 audit UI |

### Matriks Risiko (diurutkan)

| Kode | Severity | Kesulitan Fix | Prioritas |
|---|---|---|---|
| T-B1-01 | 🔴 Kritis | Sedang | **P0 — Sebelum go-live** |
| T-B1-02 | 🟠 Tinggi | Rendah (1 baris) | **P1 — Segera** |
| T-B1-03 | 🟠 Tinggi | Rendah (tambah validasi startup) | **P1 — Segera** |
| T-B1-05 | 🟡 Sedang | Sedang (refactor delete) | **P2 — Sebelum launch publik** |
| T-B1-07 | 🟡 Sedang | Rendah (migrasi + isi saat register) | **P2 — Sebelum launch publik** |
| T-B1-09 | 🟡 Sedang | Rendah (hapus fallback, tambah throw) | **P1 — Segera** |
| T-B1-06 | 🟡 Sedang | Rendah (buat 2 halaman UI) | **P2 — Sebelum launch publik** |

---

## 5. Informasi Wajib Penutup B1

**File yang sudah dibaca:** auth.ts, login/email/page.tsx, actions.ts, admin-actions.ts, admin/layout.tsx, session-auth.ts, middleware/auth.ts, routes/keys.ts, schema.ts, keys.ts, provider-crypto.ts, .env.example (dikonfirmasi placeholder).

**File yang belum dibaca (relevan B1):**
- `apps/web/src/app/admin/audit/` — apakah UI read-only?
- Konfigurasi Better Auth hash algorithm internal (di `node_modules`)

**Yang butuh uji manual:**
1. Alur registrasi: apakah `autoSignIn: true` memperbolehkan akses sebelum email diverifikasi?
2. TTL token reset password.
3. Respons seragam forgot password (email terdaftar vs. tidak).
4. PKCE enforcement pada Google/GitHub OAuth.

**Catatan Pencabutan T-B1-04:** Temuan "secret di `.env.example`" dicabut setelah konfirmasi dari pemilik kode — file aktual menggunakan placeholder aman (`isi_dari_google_cloud_console`, nilai kosong, `000...`), tidak di-push ke GitHub, dan `PROVIDER_ENC_KEY` all-zeros sudah ditolak oleh validasi di `provider-crypto.ts:7`.

---
*Laporan B1 (versi revisi) disimpan di: `audit-out/prd-conformance/B1-auth.md`.*
