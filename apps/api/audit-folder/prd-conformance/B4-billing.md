# LAPORAN TAHAP B4: FR-BILL (Billing, Saldo & Payment Gateway)

**Tanggal Audit:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Modul:** FR-BILL-01..12, SR-05, BILL-01..14, DM-ENT-05..08, DM-RULE-01..04, API-CON-BILL, API-WH-PAY, OPS-SLO-03, OPS-SLO-05, OPS-ALT-02, OPS-ALT-07, OPS-ALT-08, OPS-RB-05, OPS-RB-06, LEGAL-04  
**File Kode Diperiksa:**
- [`packages/db/src/billing.ts`](file:///c:/Users/esc/Desktop/morphic/packages/db/src/billing.ts)
- [`packages/db/src/schema.ts`](file:///c:/Users/esc/Desktop/morphic/packages/db/src/schema.ts)
- [`apps/api/src/routes/payments.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/payments.ts)
- [`apps/api/src/routes/webhooks.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/webhooks.ts)
- [`apps/api/src/routes/account.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/account.ts)
- [`apps/api/src/routes/redeem.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/redeem.ts)
- [`apps/api/src/lib/duitku.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/lib/duitku.ts)
- [`apps/api/src/lib/paypal.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/lib/paypal.ts)
- [`apps/api/src/lib/paypal-reconcile.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/lib/paypal-reconcile.ts)
- [`packages/shared/src/credits.ts`](file:///c:/Users/esc/Desktop/morphic/packages/shared/src/credits.ts)
- [`apps/web/src/lib/actions.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/actions.ts)
- [`apps/web/src/components/PricingFaq.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/components/PricingFaq.tsx)

---

## 1. Tabel Pemetaan Kebutuhan PRD (FR-BILL-01 s/d FR-BILL-12)

| ID PRD | Kebutuhan PRD | Prioritas / Fase | Status | Bukti Kode (file:baris) | Penjelasan & Bukti Lapangan |
|---|---|---|---|---|---|
| **FR-BILL-01** | Dompet saldo prepaid berbasis ledger append-only. Saldo = hasil penjumlahan ledger; tidak ada update langsung tanpa entri ledger. | M (Must) / Fase 1 | **IMPLEMENTED** | `billing.ts:43-70, 515-526`; `schema.ts:181-220` | **Terpenuhi:** Fungsi `writeBalanceLedger` menyisipkan baris `creditLedger` dan mengupdate `balances.credits` secara atomik dalam satu transaksi. Cache saldo direkonsiliasi dengan `sum(creditLedger.amount)`.<br>**Catatan Deviasi Skema:** Tabel bernama `balances` (per user) bukan `wallets` (per org multi-currency); kolom `idempotency_key` unik DB tidak ada di `credit_ledger` (hanya `reference`). |
| **FR-BILL-02** | Top-up lewat hosted checkout payment gateway. Data kartu tidak menyentuh server. | M (Must) / Fase 1 | **IMPLEMENTED** | `payments.ts:167-208, 360-393`; `duitku.ts:71-127`; `paypal.ts:174-229` | **Terpenuhi:** Duitku menggunakan QRIS URL/String (`paymentUrl`, `qrString`), PayPal menggunakan approval redirect URL (`approveUrl`). Tidak ada form input kartu atau data sensitif PAN/CVV yang melewati server (mematuhi cakupan minimal PCI-DSS, BILL-11). |
| **FR-BILL-03** | Webhook pembayaran: verifikasi signature, anti-replay, idempoten, validasi jumlah/mata uang. Webhook duplikat tidak menambah saldo. | M (Must) / Fase 1 | **PARTIAL** | `webhooks.ts:86-229`; `duitku.ts:201-212`; `schema.ts:345-352` | **Terpenuhi untuk Duitku:** Verifikasi MD5 HMAC signature (`timingSafeEqual`), idempotency via `payment_events` unique index `(provider, event_id)`, validasi nominal amount, serta outbound status inquiry via API (`checkTransactionStatus`).<br>**Gagal / Hilang untuk PayPal:** **PayPal tidak memiliki webhook handler** di `webhooks.ts`! Alur PayPal sepenuhnya bergantung pada client-side capture polling dan cron batch. |
| **FR-BILL-04** | Reservasi → settle saldo pada tiap request. Saldo tidak pernah negatif akibat request paralel. | M (Must) / Fase 1 | **IMPLEMENTED** | `billing.ts:100-187, 189-280, 282-320, 323-337` | **Terpenuhi:** `reserve()` mengunci row balance via SQL `FOR UPDATE`, memotong ceiling estimasi token, dan melempar `InsufficientCreditsError` jika kurang. `settle()` mengunci reservasi, menghitung penggunaan aktual, me-refund kelebihan kredit, dan meng-clamp pemotongan agar tidak melebihi estimasi. Sweeper membersihkan reservasi kadaluarsa (TTL 10m). |
| **FR-BILL-05** | Tabel harga per model (per 1 juta token) + markup yang dikonfigurasi admin. Harga dihitung server-side; perubahan harga tercatat di audit log. | M (Must) / Fase 1 | **PARTIAL** | `schema.ts:121-124`; `credits.ts:1-49`; `router.ts:88-91` | **Terpenuhi:** Tabel `models` menyimpan `inputCreditsPer1m` dan `outputCreditsPer1m`. Perhitungan kredit berjalan 100% server-side.<br>**Gap:** Tidak ada pemisahan antara biaya modal hulu vs markup margin. Biaya modal hulu tidak disimpan, sehingga sistem tidak dapat membunyikan alert margin negatif (BILL-12 / OPS-ALT-02). |
| **FR-BILL-06** | Notifikasi saldo rendah + auto-suspend saat saldo habis. Ambang terkonfigurasi; request ditolak 402 saat saldo habis. | M (Must) / Fase 1 | **PARTIAL** | `billing.ts:131, 239`; `v1.ts:237-260` | **Terpenuhi:** Auto-reject 402 Payment Required berfungsi saat saldo tidak mencukupi untuk reservasi (`InsufficientCreditsError`).<br>**Hilang:** **Tidak ada sistem peringatan saldo rendah (low balance warning/email)**. Tidak ada konfigurasi ambang batas saldo minimal bagi pengguna. |
| **FR-BILL-07** | Kuitansi/invoice + riwayat transaksi. Dapat diunduh; konsisten dengan ledger. | M (Must) / Fase 1 | **PARTIAL** | `account.ts:97-140, 179-219`; `PricingFaq.tsx:59-64` | **Terpenuhi:** Endpoint riwayat mutasi kredit `/v1/account/transactions` dan riwayat pembayaran `/v1/account/payments` tersedia.<br>**Pelanggaran / Hilang:** **Fitur unduh invoice/kuitansi (PDF/HTML) tidak ada**, meskipun materi FAQ di frontend menjanjikan invoice dapat diunduh kapan saja untuk reimburse kantor. |
| **FR-BILL-08** | Refund dan penanganan chargeback. Chargeback → penangguhan akun/saldo sesuai kebijakan. | S (Should) / Fase 1 | **MISSING** | `schema.ts:197-208, 334`; `payments.ts`; `webhooks.ts` | Enum skema memuat tipe `'refund'` dan status `'refunded'`, tetapi **tidak ada kode implementasi untuk memproses refund, memotong kembali kredit, menangani chargeback/dispute gateway, atau men-suspend akun** saat terjadi sengketa. |
| **FR-BILL-09** | Kode promo/referral dengan proteksi abuse. Satu redeem per akun/perangkat; deteksi multi-akun. | C (Could) / Fase 1 | **PARTIAL** | `redeem.ts:1-190`; `schema.ts:356-385` | **Terpenuhi:** Redeem kode promo transaksional atomik dengan kuota maksimum (`maxRedemptions`) dan pencegahan klaim ganda per akun via unique index `(code_id, user_id)`.<br>**Gap:** Proteksi abuse hanya berbasis `user_id`, tanpa fingerprinting perangkat atau IP untuk menangkal multi-akun. |
| **FR-BILL-10** | Auto top-up. Ambang dan batas bulanan yang ditetapkan pengguna. | C (Could) / Fase 3 | **MISSING** | — | Sesuai PRD, fitur ini dijadwalkan untuk rilis Fase 3. Belum ada implementasi tokenisasi kartu atau recurring billing. |
| **FR-BILL-11** | Pajak (mis. PPN) sesuai yurisdiksi. Tarif dan label pajak tampil di invoice. | S (Should) / Fase 1 | **MISSING** | `schema.ts:253-266`; `payments.ts` | Seluruh transaksi dihitung nett tanpa pemisahan komponen PPN (Pajak Pertambahan Nilai 11%/12%). Tidak ada kolom atau logika pajak di database dan invoice. |
| **FR-BILL-12** | Perhitungan uang memakai tipe integer/decimal. Tidak ada float pada perhitungan uang. | M (Must) / Fase 1 | **IMPLEMENTED** | `schema.ts:185, 209, 330`; `credits.ts:18, 46` | Saldo kredit (`bigint`), mutasi amount (`bigint`), dan harga IDR/USD (`amountCents` integer) disimpan tanpa floating point. Seluruh konversi menggunakan `Math.ceil` dan `Math.round`. |

---

## 2. Tabel Pemetaan Kontrol Keamanan Billing (BILL-01 s/d BILL-14)

| ID Kontrol | Deskripsi Kontrol Keamanan | Status | Bukti Kode (file:baris) | Evaluasi & Rekomendasi Auditor |
|---|---|---|---|---|
| **BILL-01** | Model ledger ganda / append-only: saldo diturunkan dari histori mutasi, bukan angka statis yang di-update langsung. | **IMPLEMENTED** | `billing.ts:43-70, 515-526` | Setiap mutasi menulis baris baru di `credit_ledger` dan mengupdate cache saldo secara atomik. Fungsi `reconcileBalance` dapat merekonstruksi saldo dari total ledger. |
| **BILL-02** | Isolasi saldo saat request paralel (reserve saldo sebelum panggilan hulu, commit setelah selesai) cegah saldo minus. | **IMPLEMENTED** | `billing.ts:100-187, 189-280` | Menggunakan locking `FOR UPDATE` pada baris saldo pengguna saat reservasi plafon kredit. Saldo tidak dapat minus akibat request paralel. |
| **BILL-03** | Harga per model dihitung server-side dari tabel konfigurasi; dilarang menerima nilai harga dari request klien. | **IMPLEMENTED** | `credits.ts:1-49`; `router.ts:88-91` | Harga diambil dari tabel `models` di database server; klien hanya mengirim nama alias model. |
| **BILL-04** | Metering token akurat: token input/output dihitung per request, timeout ditangani konsisten. | **IMPLEMENTED** | `billing.ts:220-237`; `schema.ts:292-316` | Setiap eksekusi mencatat `usage_records` unik dengan detail token, latensi, status, dan biaya kredit. |
| **BILL-05** | Webhook pembayaran memvalidasi signature kriptografis sebelum memproses kredit. | **PARTIAL** | `webhooks.ts:126`; `duitku.ts:201-212` | Webhook Duitku memvalidasi signature MD5 secara aman dengan `timingSafeEqual`. Namun **PayPal tidak memiliki webhook receiver**. |
| **BILL-06** | Penanganan webhook bersifat idempoten: request berulang dengan event ID sama dilarang menambah saldo ganda. | **IMPLEMENTED** | `webhooks.ts:141-150`; `schema.ts:345-352` | Tabel `payment_events` memiliki unique index `(provider, event_id)` di PostgreSQL, menjamin penolakan pemrosesan event duplikat. |
| **BILL-07** | Timestamp webhook diverifikasi untuk mencegah serangan replay. | **PARTIAL** | `webhooks.ts:96-150` | Idempotency event ID aktif, namun tidak ada verifikasi expiry window pada timestamp payload callback Duitku. |
| **BILL-08** | Proteksi terhadap card testing / fraud: pembatasan frekuensi top-up, integrasi 3DSecure / risk score. | **IMPLEMENTED** | `payments.ts:67-87, 293-313`; `paypal-reconcile.ts:14-16` | Dibatasi maksimal 5 pembuatan invoice pending per user per jam. Invoice Duitku kedaluwarsa ketat dalam 5 menit. Tidak ada penerimaan kartu kredit mentah. |
| **BILL-09** | Penanganan refund / chargeback: saldo ditarik kembali; jika tidak cukup, akun disuspend. | **MISSING** | `payments.ts`; `webhooks.ts` | Belum ada alur penarikan saldo akibat refund atau penanganan sengketa chargeback payment gateway. |
| **BILL-10** | Voucher / kode promo divalidasi satu kali pakai per pengguna; proteksi race condition saat klaim. | **IMPLEMENTED** | `redeem.ts:84-106`; `schema.ts:372-385` | Transaksi atomik dengan conditional update kuota promo dan unique index `(code_id, user_id)` di tabel `redemptions`. |
| **BILL-11** | Data sensitif kartu (PAN, CVV) dilarang menyentuh server (hosted checkout). | **IMPLEMENTED** | `payments.ts:198, 391` | Pengguna membayar via QRIS statis/dinamis Duitku atau halaman resmi PayPal hosted checkout. |
| **BILL-12** | Alert margin negatif: alarm berbunyi jika harga jual model lebih rendah dari biaya pemanggilan hulu. | **MISSING** | `schema.ts:121-124` | Tabel `models` tidak menyimpan data biaya modal hulu, sehingga komparasi margin tidak dapat dilakukan. |
| **BILL-13** | Riwayat transaksi (ledger/invoice) dapat diunduh pengguna dan konsisten dengan saldo aktif. | **PARTIAL** | `account.ts:97-140` | Riwayat mutasi tersedia via API, tetapi fitur ekspor file atau download invoice belum tersedia. |
| **BILL-14** | Nilai uang memakai tipe data integer/decimal, tanpa floating-point. | **IMPLEMENTED** | `schema.ts:185, 209, 330`; `credits.ts:18, 46` | Seluruh kalkulasi saldo dan transaksi memakai `bigint` dan `integer` minor unit (cents/rupiah). |

---

## 3. Temuan Keamanan & Kepatuhan — Diurutkan Berdasarkan Risiko

### 🟠 TINGGI — T-B4-01: Ketiadaan Inbound Webhook untuk PayPal; Alur Pembayaran Mengandalkan Client Capture & Polling
- **ID PRD Terkait:** FR-BILL-03, BILL-05, BILL-06, OPS-SLO-05
- **Butir Audit:** BILL-05 (Webhook Signature Verification), BILL-06 (Idempotent Webhook Processing)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/routes/webhooks.ts:26, 96`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\webhooks.ts#L26):
  Hanya ada dua route webhook di `webhooks.ts`:
  - `webhooks.post('/mock', ...)`
  - `webhooks.post('/duitku', ...)`
  Endpoint `/webhooks/paypal` **tidak ada sama sekali**.
  [`apps/api/src/routes/payments.ts:397-520`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\payments.ts#L397-L520):
  Pemenuhan kredit PayPal bergantung sepenuhnya pada request browser klien ke `POST /v1/payments/paypal/capture`.
- **Dampak Keamanan & Bisnis:**
  1. **Abandoned Order / Fulfill Drop-off:** Jika pengguna telah menyetujui pembayaran di PayPal, tetapi browser tertutup, koneksi internet terputus, atau tab crash sebelum mengeksekusi endpoint `/paypal/capture`, dana pengguna telah terdebit di PayPal namun saldo Morphic **tidak bertambah** hingga job rekonsiliasi periodik berjalan (delay hingga 15 menit, melanggar OPS-SLO-05 yang menargetkan proses p95 ≤ 10 detik).
  2. **Ketergantungan Client-Side:** Mengandalkan browser klien untuk memicu capture backend adalah anti-pattern dalam arsitektur payment gateway produksi.
- **Mitigasi Cepat:**
  Daftarkan webhook listener `POST /webhooks/paypal` di `webhooks.ts` yang memverifikasi signature sertifikat PayPal (`paypal.verifyWebhookSignature`) untuk event `PAYMENT.CAPTURE.COMPLETED` dan `CHECKOUT.ORDER.APPROVED`.

---

### 🟡 SEDANG — T-B4-02: Fitur Unduh Invoice/Kuitansi Resmi Tidak Tersedia (Janji Pemasaran Tidak Terpenuhi)
- **ID PRD Terkait:** FR-BILL-07, BILL-13, POL-PRIC-04
- **Butir Audit:** BILL-13 (Transaction History & Downloadable Invoices)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/web/src/components/PricingFaq.tsx:63-64`](file:///c:/Users/esc\Desktop\morphic\apps\web\src\components\PricingFaq.tsx#L63-L64):
  ```typescript
  id: 'Ya, setiap transaksi top-up QRIS otomatis menghasilkan invoice digital dan bukti bayar resmi lengkap dengan nomor referensi transaksi yang dapat Anda unduh dari dashboard billing kapan saja.',
  en: 'Yes, every QRIS top-up transaction automatically generates a downloadable digital invoice and receipt with transaction reference IDs from your billing dashboard.',
  ```
  Di database (`schema.ts`) maupun router API (`apps/api/src/routes/account.ts`), **tidak ada entitas tabel invoice, tidak ada generator PDF/HTML invoice, dan tidak ada tombol download kuitansi di UI**.
- **Dampak Keamanan & Bisnis:**
  1. **Ketidaksesuaian Klaim Layanan (Misleading Claim):** Pelanggan enterprise atau korporat yang membutuhkan kuitansi fisik/PDF untuk klaim pengeluaran (reimburse) kantor akan kecewa karena fitur yang dijanjikan di FAQ publik tidak tersedia.
  2. Melanggar prinsip PRD FR-BILL-07 (*Kuitansi/invoice dapat diunduh dan konsisten dengan ledger*).
- **Mitigasi Cepat:**
  Sediakan endpoint `GET /v1/account/payments/:id/invoice` yang mengembalikan tampilan HTML cetak invoice resmi atau PDF yang mencantumkan nama entitas, tanggal pembayaran, referensi transaksi Duitku/PayPal, dan rincian kuota kredit yang dibeli.

---

### 🟡 SEDANG — T-B4-03: Ketiadaan Sistem Notifikasi Saldo Rendah (Low-Balance Warning)
- **ID PRD Terkait:** FR-BILL-06, BILL-02, FR-NOT-01
- **Butir Audit:** BILL-02 (Balance Depletion Warnings)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`packages/db/src/billing.ts:130-134`](file:///c:/Users/esc\Desktop\morphic\packages\db\src\billing.ts#L130-L134):
  ```typescript
  const source = await pickSource(tx, input.userId, input.model.id, estimatedCredits);
  if (!source) {
    throw new InsufficientCreditsError(
      `insufficient credits: need >= ${estimatedCredits} reserved`,
    );
  }
  ```
  Pengecekan saldo hanya terjadi biner: cukup atau gagal. Tidak ada threshold configurable (misal sisa saldo < 10.000 kredit), tidak ada event triggering email "Saldo Anda Rendah", dan tidak ada webhook peringatan ke pengguna.
- **Dampak Keamanan & Bisnis:**
  Aplikasi AI pengguna di lingkungan produksi tiba-tiba mengalami error 402 tanpa ada peringatan awal bahwa saldo mereka hampir habis. Ini merusak keandalan integrasi pengguna akhir dengan API Morphic.
- **Mitigasi Cepat:**
  Tambahkan field `low_balance_threshold` pada profil pengguna dan kirimkan email peringatan (FR-NOT-01) saat sisa saldo pasca-settlement berada di bawah ambang batas tersebut.

---

### 🟡 SEDANG — T-B4-04: Ketiadaan Alur Penanganan Refund, Dispute, dan Chargeback Payment Gateway
- **ID PRD Terkait:** FR-BILL-08, BILL-09, OPS-RB-05
- **Butir Audit:** BILL-09 (Refund & Chargeback Handling)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`packages/db/src/schema.ts:198-207`](file:///c:/Users/esc\Desktop\morphic\packages\db\src\schema.ts#L198-L207):
  Enum `creditLedger.entryType` memuat `'refund'`, dan enum `payments.status` memuat `'refunded'`. Namun tidak ada fungsi penanganan refund di `billing.ts`, tidak ada endpoint admin untuk memproses refund, dan tidak ada webhook listener untuk event chargeback PayPal (`CUSTOMER.DISPUTE.CREATED`).
- **Dampak Keamanan & Bisnis:**
  Jika terjadi carding atau pembeli membuka dispute/chargeback di PayPal, admin tidak memiliki instrumen kode untuk membatalkan kredit yang telah diberikan secara otomatis. Jika kredit telah digunakan habis, tidak ada logika untuk menangguhkan (suspend) akun pengguna tersebut (melanggar FR-BILL-08).
- **Mitigasi Cepat:**
  Implementasikan fungsi `processRefund(paymentId)` yang mendebet saldo melalui ledger entry tipe `refund`, mengubah status pembayaran menjadi `refunded`, dan secara otomatis men-suspend akun jika saldo balance menjadi negatif.

---

### 🟡 SEDANG — T-B4-05: Ketiadaan Pelacakan Modal Hulu dan Sistem Deteksi Margin Negatif
- **ID PRD Terkait:** FR-BILL-05, BILL-12, OPS-ALT-02
- **Butir Audit:** BILL-12 (Negative Margin Alerting)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`packages/db/src/schema.ts:121-124`](file:///c:/Users/esc\Desktop\morphic\packages\db\src\schema.ts#L121-L124):
  Tabel `models` hanya menyimpan:
  ```typescript
  inputCreditsPer1m: integer('input_credits_per_1m').notNull().default(0),
  outputCreditsPer1m: integer('output_credits_per_1m').notNull().default(0),
  ```
  Tidak ada kolom `upstreamCostInputPer1m` atau `upstreamCostOutputPer1m`.
- **Dampak Keamanan & Bisnis:**
  Sistem tidak memiliki data biaya modal hulu untuk setiap model. Jika penyedia hulu menaikkan harga atau admin salah mengonfigurasi tarif jual di panel admin, sistem tidak dapat mendeteksi bahwa Morphic sedang merugi (margin negatif) per request (melanggar alert wajib OPS-ALT-02).
- **Mitigasi Cepat:**
  Tambahkan kolom biaya modal hulu pada tabel `models` dan pasang validasi harga di router admin yang memicu notifikasi jika `harga_jual < biaya_hulu`.

---

### 🔵 RENDAH — T-B4-06: Kolom Referensi Mutasi di `credit_ledger` Tidak Memiliki Constraint UNIQUE
- **ID PRD Terkait:** FR-BILL-01, DM-RULE-01, DM-ENT-06
- **Butir Audit:** DM-RULE-01 (Ledger Idempotency Unique Constraint)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`packages/db/src/schema.ts:213`](file:///c:/Users/esc\Desktop\morphic\packages\db\src\schema.ts#L213):
  `reference: text('reference')` di tabel `credit_ledger` tidak memiliki constraint `unique()` atau `uniqueIndex`.
- **Dampak Keamanan & Bisnis:**
  Jaminan idempotensi entri ledger hanya bersandar pada logika aplikasi. Jika terjadi bug konkuren pada pemanggil fungsi grant saldo, database tidak dapat menolak entri ledger ganda dengan referensi yang sama.
- **Mitigasi Cepat:**
  Tambahkan kolom `idempotency_key` bertipe text dengan index `uniqueIndex('credit_ledger_idempotency_idx')` pada tabel `credit_ledger`.

---

### 🔵 RENDAH — T-B4-07: Validasi Kode Promo Tidak Membatasi Multi-Accounting via IP / Device Fingerprint
- **ID PRD Terkait:** FR-BILL-09, BILL-10
- **Butir Audit:** BILL-10 (Promo Code Abuse Protection)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/routes/redeem.ts:105`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\redeem.ts#L105):
  Pengecekan klaim hanya memverifikasi `(code_id, user_id)`.
- **Dampak Keamanan & Bisnis:**
  Seorang pengguna dapat membuat banyak akun email palsu untuk meredeem kode voucher promosi berulang kali.
- **Mitigasi Cepat:**
  Simpan IP address dan user agent saat redeem, dan batasi jumlah klaim per subnet IP.

---

### 🔵 RENDAH — T-B4-08: Rincian Pajak (PPN) Tidak Dihitung pada Harga Paket dan Transaksi
- **ID PRD Terkait:** FR-BILL-11, LEGAL-04
- **Butir Audit:** LEGAL-04 (Tax Calculation Compliance)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`packages/db/src/schema.ts:253-266`](file:///c:/Users/esc\Desktop\morphic\packages\db\src\schema.ts#L253-L266):
  Tabel `packages` dan `payments` hanya menyimpan `amountCents` bulat tanpa pemisahan kolom dasar pengenaan pajak (DPP) dan PPN.
- **Dampak Keamanan & Bisnis:**
  Pelanggan tidak menerima rincian PPN 11%/12% yang tertera pada bukti potong tagihan resmi Indonesia.
- **Mitigasi Cepat:**
  Tambahkan kalkulasi komponen pajak pada tampilan checkout dan invoice digital.

---

## 4. Analisis Mendalam atas 6 Pertanyaan Kunci Billing Conformance

### 1. Integritas Arsitektur Ledger Append-Only vs Saldo Cache
- Desain arsitektur mutasi saldo Morphic sangat solid. Fungsi `writeBalanceLedger` (`billing.ts:43`) selalu menyisipkan record ke `credit_ledger` dan mengupdate `balances` secara bersamaan di dalam blok transaksi PostgreSQL yang sama.
- Saldo cache tidak pernah ditulis secara manual di luar fungsi ledger.
- Fitur pemulihan drift saldo `reconcileBalance` (`billing.ts:515`) berfungsi dengan benar menghitung ulang akumulasi nominal ledger menggunakan `coalesce(sum(amount), 0)`.

### 2. Siklus Konkurensi Reservasi dan Penyelesaian (Reserve -> Settle)
- Sistem kebal terhadap race condition saldo minus berkat penggunaan klausa `FOR UPDATE` saat memverifikasi saldo di `pickSource` (`billing.ts:104`).
- Plafon estimasi kredit dipotong di muka saat request dimulai, dan kelebihan reservasi dikembalikan secara aman saat `settle()` atau di-sweep oleh background sweeper jika terjadi crash (TTL 10 menit).

### 3. Keandalan dan Idempotensi Webhook Payment Gateway
- Webhook Duitku diimplementasikan dengan standar keamanan tinggi: verifikasi signature MD5 dengan `timingSafeEqual`, deduplikasi idempotensi event via tabel database `payment_events`, validasi kecocokan nominal, dan pemeriksaan status keluar via API Duitku (`checkTransactionStatus`).
- **Kelemahan Kritis:** Integrasi PayPal belum memiliki webhook receiver di backend, sehingga pembayaran PayPal rentan menggantung jika sesi browser pengguna terputus sebelum memanggil endpoint capture (T-B4-01).

### 4. Pencegahan Card Testing dan Serangan Spam Transaksi
- Endpoint pembuatan pembayaran `POST /v1/payments/create` membatasi maksimal 5 invoice pending per jam per user (`payments.ts:67`).
- Invoice QRIS Duitku dibatasi masa aktifnya hanya 5 menit (`DUITKU_PAYMENT_TTL_MINUTES`), dan sistem membatalkan invoice lama sebelum membuat invoice baru untuk user yang sama (`payments.ts:133`).
- Data kartu kredit tidak pernah diterima di server Morphic, meminimalisir risiko penipuan carding langsung.

### 5. Rekonsiliasi Otomatis dan Penanganan Transaksi Stale
- Modul `paypal-reconcile.ts` menyediakan fungsi `reconcilePaypalPayments` dan `sweepStaleDuitkuPayments` yang secara berkala memeriksa transaksi yang berumur lebih dari 15 menit langsung ke API gateway Duitku dan PayPal.
- Fungsi `processPaymentSuccess` mampu me-rescue transaksi yang sebelumnya berstatus `pending`, `capturing`, bahkan `failed`/`expired` menjadi `paid` secara atomik jika gateway menyatakan transaksi tersebut sah.

### 6. Transparansi Dokumen Transaksi (Invoice & Receipt)
- Riwayat transaksi numerik tersedia lengkap melalui endpoint REST `/v1/account/transactions` dan `/v1/account/payments`.
- Namun ketiadaan template invoice digital atau PDF yang dapat diunduh merupakan deviasi terhadap PRD FR-BILL-07 dan janji pemasaran FAQ di aplikasi web (T-B4-02).

---

## 5. Rekapitulasi Status & Matriks Risiko

### 5.1 Ringkasan Status Kebutuhan FR-BILL (12 Butir)
| Status | Jumlah | Persentase | Rincian Butir |
|---|---|---|---|
| **IMPLEMENTED** | 4 | 33.3% | FR-BILL-01, FR-BILL-02, FR-BILL-04, FR-BILL-12 |
| **PARTIAL** | 5 | 41.7% | FR-BILL-03, FR-BILL-05, FR-BILL-06, FR-BILL-07, FR-BILL-09 |
| **MISSING** | 3 | 25.0% | FR-BILL-08, FR-BILL-10 (Fase 3), FR-BILL-11 |
| **TOTAL** | **12** | **100%** | |

### 5.2 Matriks Temuan Berdasarkan Keparahan
| Tingkat Keparahan | Jumlah | Kode Temuan |
|---|---|---|
| 🔴 **Kritis** | 0 | — |
| 🟠 **Tinggi** | 1 | T-B4-01 |
| 🟡 **Sedang** | 4 | T-B4-02, T-B4-03, T-B4-04, T-B4-05 |
| 🔵 **Rendah** | 3 | T-B4-06, T-B4-07, T-B4-08 |
| **TOTAL TEMUAN** | **8** | |

### 5.3 Prioritas Tindakan Perbaikan
1. **P0 (Integritas Pembayaran & Pemenuhan Kredit):**
   - Implementasikan listener inbound webhook untuk PayPal di `webhooks.ts` agar pembayaran tidak bergantung pada client capture browser (T-B4-01).
2. **P1 (Kepatuhan Layanan & Kontrol Keuangan):**
   - Bangun fitur unduh invoice resmi digital (PDF/HTML) di dashboard billing (T-B4-02).
   - Pasang background job peringatan saldo rendah (low-balance alert) ke email pengguna (T-B4-03).
   - Buat alur admin untuk penanganan refund dan chargeback (T-B4-04).
   - Tambahkan pencatatan modal hulu pada model untuk deteksi margin negatif (T-B4-05).
3. **P2 (Pengerasan Integritas Database):**
   - Tambahkan constraint UNIQUE pada `idempotency_key` tabel `credit_ledger` (T-B4-06).
   - Tambahkan pemisahan komponen pajak PPN pada transaksi (T-B4-08).

---

## 6. Informasi Wajib Penutup B4 & Update Handoff

### 6.1 File yang Sudah Dibaca Lengkap
1. `packages/db/src/billing.ts` (531 baris)
2. `packages/db/src/schema.ts` (435 baris)
3. `apps/api/src/routes/payments.ts` (589 baris)
4. `apps/api/src/routes/webhooks.ts` (232 baris)
5. `apps/api/src/routes/account.ts` (220 baris)
6. `apps/api/src/routes/redeem.ts` (190 baris)
7. `apps/api/src/lib/duitku.ts` (213 baris)
8. `apps/api/src/lib/paypal.ts` (317 baris)
9. `apps/api/src/lib/paypal-reconcile.ts` (150 baris)
10. `packages/shared/src/credits.ts` (49 baris)
11. `apps/web/src/lib/actions.ts` (574 baris)

### 6.2 Hal yang Butuh Uji Manual di Staging
1. Uji skenario drop-off browser saat checkout PayPal (bayar di PayPal, tutup browser sebelum capture) dan verifikasi waktu pemulihan kredit via rekonsiliasi.
2. Uji simulasi webhook Duitku dengan nominal yang diubah (amount mismatch injection) untuk memastikan sistem menolak penambahan saldo.
3. Stress test konkurensi klaim kode promo (100 request simultan pada kuota voucher 1) untuk membuktikan integritas unique constraint `redemptions`.
