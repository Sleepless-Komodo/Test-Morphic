# Fix Plan — Kontrak Antarmuka API (FIX_CONTRACT.md)

**Platform:** Morphic AI API Gateway (`apps/api`)  
**Dibuat:** 2026-10-04  
**Tujuan:** Mendokumentasikan seluruh perubahan pada kontrak HTTP publik, skema response JSON, dan header standar.  
**Klasifikasi:** Label `[BREAKING]` (perubahan yang dapat memengaruhi integrasi klien eksisting) vs `[NON-BREAKING]` (perubahan aditif/kompatibel).

---

## 1. Perubahan Endpoint Manajemen Kunci (`/v1/keys`)

### [FIX-CONTRACT-01] `GET /v1/keys` — Penghapusan Properti `key` Plaintext `[BREAKING]`
- **Metode & Rute:** `GET /v1/keys`
- **Tipe Perubahan:** `[BREAKING]` untuk klien yang bergantung pada pembacaan key lama via API
- **Alasan:** Mematuhi prinsip zero-plaintext storage dan NIST SP 800-63B (T-B2-01, T-B2-02).
- **Kontrak Sebelum (Lama):**
  ```json
  [
    {
      "id": "key_uuid_123",
      "name": "Production Key",
      "key": "mp-sk-live-abcdef123456...", // <-- Plaintext dikembalikan
      "prefix": "mp-sk-live-abcd...",
      "createdAt": "2026-10-01T00:00:00.000Z"
    }
  ]
  ```
- **Kontrak Sesudah (Baru):**
  ```json
  [
    {
      "id": "key_uuid_123",
      "name": "Production Key",
      "prefix": "mp-sk-live-abcd...",       // Properti 'key' DIHAPUS TOTAL
      "createdAt": "2026-10-01T00:00:00.000Z"
    }
  ]
  ```
- **Catatan Migrasi SDK:** Klien SDK tidak boleh berasumsi field `key` ada saat memanggil `GET /v1/keys`. Key hanya diterima sekali saat `POST /v1/keys`.

---

### [FIX-CONTRACT-02] `POST /v1/keys` — Kuota Batas Maksimal Key `[NON-BREAKING]`
- **Metode & Rute:** `POST /v1/keys`
- **Tipe Perubahan:** `[NON-BREAKING]` (hanya memengaruhi request yang melanggar batas kuota 20 key)
- **Status Baru Saat Melampaui Batas:** `400 Bad Request`
- **Payload Respons Error:**
  ```json
  {
    "error": {
      "message": "maximum number of API keys reached (20)",
      "type": "invalid_request_error",
      "code": "key_quota_exceeded",
      "request_id": "req_uuid_123"
    }
  }
  ```

---

### [FIX-CONTRACT-03] `POST /v1/keys/:id/rotate` — Endpoint Rotasi Baru `[NON-BREAKING (BARU)]`
- **Metode & Rute:** `POST /v1/keys/:id/rotate`
- **Headers:** `Authorization: Bearer <user_session_token>`
- **Request Body:**
  ```json
  {
    "grace_period_seconds": 86400
  }
  ```
- **Response Body (`201 Created`):**
  ```json
  {
    "old_key_id": "key_uuid_123",
    "new_key_id": "key_uuid_456",
    "key": "mp-sk-live-newtoken987...", // Ditampilkan SEKALI
    "grace_period_expires_at": "2026-10-05T12:00:00.000Z"
  }
  ```

---

## 2. Perubahan Gateway Inferensi (`/v1/chat/completions`)

### [FIX-CONTRACT-04] Injeksi Header Kepatuhan Standar pada Seluruh Respons `[NON-BREAKING]`
- **Metode & Rute:** `POST /v1/chat/completions`, `GET /v1/models`
- **Tipe Perubahan:** `[NON-BREAKING]` (penambahan header HTTP)
- **Header Respons yang Ditambahkan:**
  - `X-Request-Id`: UUID unik untuk setiap transaksi (misal: `req_a1b2c3d4-e5f6-7890`).
  - `X-RateLimit-Limit-Requests`: Angka batas RPM (misal: `120`).
  - `X-RateLimit-Remaining-Requests`: Sisa kuota request dalam jendela aktif (misal: `119`).

---

### [FIX-CONTRACT-05] Header Standar Saat HTTP 429 Too Many Requests `[NON-BREAKING]`
- **Status HTTP:** `429 Too Many Requests`
- **Header Respons yang Wajib Ada:**
  - `Retry-After: 60` (detik sebelum request dapat diulang kembali).
  - `X-RateLimit-Limit-Requests: 120`
  - `X-RateLimit-Remaining-Requests: 0`
  - `X-Request-Id: req_uuid_...`
- **Response Body:**
  ```json
  {
    "error": {
      "message": "rate limit exceeded, please retry after 60 seconds",
      "type": "rate_limit_error",
      "code": "rate_limit_exceeded",
      "request_id": "req_uuid_..."
    }
  }
  ```

---

### [FIX-CONTRACT-06] Penyeragaman Skema Error JSON dengan `request_id` `[NON-BREAKING]`
- **Tipe Perubahan:** `[NON-BREAKING]` (penambahan properti `request_id` ke dalam objek `error`)
- **Skema Standar (PRD §14.4 & API-ERR-SCHEME):**
  ```json
  {
    "error": {
      "message": "string deskripsi kesalahan ramah pengguna",
      "type": "invalid_request_error | authentication_error | rate_limit_error | api_error",
      "code": "kode_kesalahan_spesifik",
      "request_id": "req_uuid_12345678"
    }
  }
  ```

---

### [FIX-CONTRACT-07] Pembatasan Ukuran Body Request (HTTP 413) `[NON-BREAKING]`
- **Kondisi:** Request body > 10 MB
- **Status HTTP:** `413 Payload Too Large`
- **Response Body:**
  ```json
  {
    "error": {
      "message": "payload too large, maximum allowed size is 10MB",
      "type": "invalid_request_error",
      "code": "payload_too_large",
      "request_id": "req_uuid_..."
    }
  }
  ```

---

## 3. Perubahan Endpoint Webhook (`/webhooks/*`)

### [FIX-CONTRACT-08] Nonaktifkan `/webhooks/mock` di Lingkungan Produksi `[BREAKING]`
- **Metode & Rute:** `POST /webhooks/mock`
- **Tipe Perubahan:** `[BREAKING]` untuk lingkungan produksi (rute dinonaktifkan)
- **Status di Production:** `404 Not Found`
- **Status di Development / Test:** `200 OK` (dengan verifikasi signature rahasia)

---

### [FIX-CONTRACT-09] Endpoint Webhook PayPal Server-to-Server Baru `[NON-BREAKING (BARU)]`
- **Metode & Rute:** `POST /webhooks/paypal`
- **Headers Wajib:**
  - `PAYPAL-AUTH-ALGO`
  - `PAYPAL-CERT-URL`
  - `PAYPAL-TRANSMISSION-ID`
  - `PAYPAL-TRANSMISSION-SIG`
  - `PAYPAL-TRANSMISSION-TIME`
- **Event yang Didukung:**
  - `PAYMENT.CAPTURE.COMPLETED`
  - `CHECKOUT.ORDER.APPROVED`
- **Respons (`200 OK`):**
  ```json
  { "status": "processed" }
  ```

---

## 4. Perubahan Endpoint Akun & Privasi (`/v1/account/*`)

### [FIX-CONTRACT-10] Endpoint Permohonan DSAR Baru `[NON-BREAKING (BARU)]`
- **Metode & Rute:** `POST /v1/account/dsar`
- **Auth:** `sessionAuth`
- **Response Body (`202 Accepted`):**
  ```json
  {
    "request_id": "dsar_uuid_123",
    "status": "pending",
    "estimated_completion": "2026-10-11T00:00:00.000Z"
  }
  ```

---

### [FIX-CONTRACT-11] Endpoint Unduh Invoice / Kuitansi PDF Baru `[NON-BREAKING (BARU)]`
- **Metode & Rute:** `GET /v1/payments/:id/receipt`
- **Auth:** `sessionAuth`
- **Headers Respons:**
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="receipt-morphic-<id>.pdf"`

---

*Dokumen FIX_CONTRACT.md selesai disusun. 11 perubahan kontrak diidentifikasi dan diklasifikasikan.*
