# Fix Plan — Tindakan Manusia Wajib (HUMAN_ACTIONS.md)

**Platform:** Morphic AI API Gateway  
**Dibuat:** 2026-10-04  
**Deskripsi:** Daftar tindakan operasional, legal, keamanan, dan konfigurasi cloud yang **wajib dilakukan oleh manusia** (engineering leads, devops, legal, pemilik bisnis) dan **tidak dapat diselesaikan hanya dengan commit kode aplikasi**.

---

## 1. Keamanan & Rotasi Rahasia (Secret Rotation)

### [ACT-SEC-01] Rotasi Kunci Enkripsi Master (`API_KEY_ENCRYPTION_KEY`)
- **Penanggung Jawab:** Lead Security / DevOps
- **Konteks:**
  Sebelum perbaikan FIX-BE-P0-01 dijalankan, basis data telah menyimpan ciphertext API key pengguna. Untuk memastikan postur keamanan nol-eksposur, secret enkripsi master yang lama harus dirotasi setelah seluruh kolom `encrypted_key` di-drop.
- **Langkah Tindakan:**
  1. Hasilkan kunci 256-bit baru dengan CSPRNG:
     `openssl rand -hex 32`
  2. Perbarui environment variable `API_KEY_ENCRYPTION_KEY` di penyedia hosting produksi (Vercel / Railway / AWS).
  3. Lakukan redeploy seluruh layanan.

---

### [ACT-SEC-02] Rotasi Rahasia `BETTER_AUTH_SECRET` & `SESSION_SECRET`
- **Penanggung Jawab:** DevOps
- **Konteks:**
  Memastikan seluruh sesi autentikasi dan token Better Auth yang lama kedaluwarsa secara paksa (force logout) pasca pengetatan MFA admin dan email verification.
- **Langkah Tindakan:**
  1. Generate random secret baru: `openssl rand -base64 32`.
  2. Perbarui di dashboard environment produksi.

---

### [ACT-SEC-03] Pendaftaran Webhook di Dashboard PayPal Developer
- **Penanggung Jawab:** Integrator Pembayaran / DevOps
- **Konteks:**
  Menghubungkan endpoint baru `POST /webhooks/paypal` (FIX-BE-P0-03) dengan server notifikasi PayPal.
- **Langkah Tindakan:**
  1. Masuk ke [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
  2. Buka aplikasi produksi → *Webhooks* → *Add Webhook*.
  3. Masukkan Webhook URL: `https://api.morphic.cloud/webhooks/paypal`.
  4. Centang event:
     - `Payment capture completed` (`PAYMENT.CAPTURE.COMPLETED`)
     - `Checkout order approved` (`CHECKOUT.ORDER.APPROVED`)
  5. Salin *Webhook ID* yang dihasilkan dan simpan di environment variable: `PAYPAL_WEBHOOK_ID=...`.

---

## 2. Infrastruktur Cloud & Pengaturan Layanan Email

### [ACT-INF-01] Pengaturan Domain & DNS Provider Email Transaksional (Resend / AWS SES)
- **Penanggung Jawab:** Sysadmin / DevOps
- **Konteks:**
  Mengaktifkan deliverability email untuk FIX-BE-P0-02 (verifikasi email, reset password, kuitansi).
- **Langkah Tindakan:**
  1. Buat akun organisasi di Resend (atau AWS SES).
  2. Daftarkan domain pengirim: `morphic.cloud` (atau `mail.morphic.cloud`).
  3. Tambahkan DNS Records pada Cloudflare / DNS Manager:
     - Record SPF: `v=spf1 include:... ~all`
     - Record DKIM: CNAME / TXT record unik dari Resend.
     - Record DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@morphic.cloud`.
  4. Tunggu verifikasi DNS hijau (Verified).
  5. Buat API Key dan set ke environment produksi: `RESEND_API_KEY=re_...`.

---

### [ACT-INF-02] Pengaturan Cloudflare / WAF IP Extraction Header
- **Penanggung Jawab:** DevOps / Cloud Engineer
- **Konteks:**
  Memastikan header `CF-Connecting-IP` diteruskan dengan benar dari edge network ke Hono API (FIX-BE-P2-04).
- **Langkah Tindakan:**
  1. Buka dashboard Cloudflare untuk zone `morphic.cloud`.
  2. Pastikan proxy (orange cloud) aktif untuk subdomain API.
  3. Pastikan server backend mengonfigurasi `trusted_proxies` hanya untuk IP ranges resmi Cloudflare.

---

## 3. Kepatuhan Hukum, Legalitas & Privasi (Compliance & Privacy)

### [ACT-LEG-01] Pembuatan Dokumen DPA (Data Processing Agreement) & Daftar Sub-Prosesor
- **Penanggung Jawab:** Legal Counsel / Tim Privasi
- **Konteks:**
  Memenuhi temuan T-B6-07 dan FR-PRV-05 (halaman `/privacy` wajib menyediakan DPA yang dapat diunduh dan inventaris sub-prosesor).
- **Langkah Tindakan:**
  1. Susun dokumen DPA standar Morphic untuk pelanggan korporat / enterprise.
  2. Buat daftar publik sub-prosesor pihak ketiga:
     - Cloud Hosting: Vercel / AWS
     - Database: Neon Database Inc.
     - Payment Gateways: Duitku (PT Duitku Pensipensa) & PayPal Inc.
     - AI Model Vendors: OpenAI LLC, Anthropic PBC, dll.
     - Email Delivery: Resend Inc.
  3. Publikasikan tautan unduh DPA pada halaman syarat ketentuan dan privasi.

---

### [ACT-LEG-02] Konsultasi Pajak Terkait Kewajiban PPN (11% / 12%) Transaksi Digital
- **Penanggung Jawab:** Akuntan Perusahaan / Konsultan Pajak
- **Konteks:**
  Menjawab keputusan pemilik OWN-03 (apakah platform wajib memungut PPN Perdagangan Melalui Sistem Elektronik / PMSE sesuai peraturan Dirjen Pajak RI).
- **Langkah Tindakan:**
  1. Tentukan apakah entitas bisnis berstatus PKP (Pengusaha Kena Pajak) atau ditunjuk sebagai Pemungut PPN PMSE.
  2. Jika ya: berikan instruksi kepada tim engineering untuk mengaktifkan pemotongan PPN pada kalkulasi checkout Duitku (FIX-P3).

---

## 4. Pengujian Keamanan Pihak Ketiga (Pentest) & Verifikasi

### [ACT-TST-01] Penetration Testing Eksternal Pasca-P0 (Blackbox & Graybox)
- **Penanggung Jawab:** External Security Auditor / Ethical Hacker
- **Konteks:**
  Memvalidasi efektivitas perbaikan celah keamanan kritis sebelum peluncuran komersial penuh.
- **Fokus Pengujian:**
  1. *Authentication Bypass:* verifikasi bahwa tidak ada cara untuk membuat request gateway tanpa verifikasi email atau menggunakan key yang sudah dicabut.
  2. *API Key Plaintext Leakage:* pastikan tidak ada endpoint REST, server action, atau error handler yang membocorkan hash atau key prefix.
  3. *Payment Webhook Spoofing:* uji ketahanan endpoint `/webhooks/paypal` dan `/webhooks/duitku` terhadap serangan replay attack dan tanda tangan palsu.
  4. *Denial of Service (DoS):* uji batas ukuran body 10 MB dan rate limit gateway dengan traffic generator terdistribusi.

---

*Dokumen HUMAN_ACTIONS.md selesai disusun. 7 tindakan operasional/legal dipetakan.*
