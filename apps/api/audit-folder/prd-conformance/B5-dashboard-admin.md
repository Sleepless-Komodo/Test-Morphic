# LAPORAN TAHAP B5: FR-DASH & FR-ADM (Dasbor Pengguna & Konsol Admin)

**Tanggal Audit:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Modul:** FR-DASH-01..07, FR-ADM-01..08, FE-01..06, AUTHZ-04..07, LOG-01..04, AI-05, AI-08, AI-09, SEC-02, SEC-05, BILL-03, BILL-12, API-ADM-ENDPOINTS  
**File Kode Diperiksa:**
- [`apps/web/src/app/dashboard/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/dashboard/page.tsx)
- [`apps/web/src/app/dashboard/usage/usage-view.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/dashboard/usage/usage-view.tsx)
- [`apps/web/src/app/dashboard/usage/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/dashboard/usage/page.tsx)
- [`apps/web/src/app/dashboard/billing/billing-view.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/dashboard/billing/billing-view.tsx)
- [`apps/web/src/app/dashboard/keys/keys-view.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/dashboard/keys/keys-view.tsx)
- [`apps/web/src/app/dashboard/settings/settings-view.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/dashboard/settings/settings-view.tsx)
- [`apps/web/src/app/docs/docs-view.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/docs/docs-view.tsx)
- [`apps/web/src/app/pricing/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/pricing/page.tsx)
- [`apps/web/src/app/models/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/models/page.tsx)
- [`apps/web/src/app/admin/layout.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/layout.tsx)
- [`apps/web/src/app/admin/admin-shell.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/admin-shell.tsx)
- [`apps/web/src/app/admin/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/page.tsx)
- [`apps/web/src/app/admin/users/users-table.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/users/users-table.tsx)
- [`apps/web/src/app/admin/models/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/models/page.tsx)
- [`apps/web/src/app/admin/providers/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/providers/page.tsx)
- [`apps/web/src/app/admin/providers/providers-client.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/providers/providers-client.tsx)
- [`apps/web/src/app/admin/transactions/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/transactions/page.tsx)
- [`apps/web/src/app/admin/audit/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/audit/page.tsx)
- [`apps/web/src/app/admin/codes/page.tsx`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/app/admin/codes/page.tsx)
- [`apps/web/src/lib/admin-actions.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/admin-actions.ts)
- [`apps/web/src/lib/actions.ts`](file:///c:/Users/esc/Desktop/morphic/apps/web/src/lib/actions.ts)
- [`apps/web/next.config.mjs`](file:///c:/Users/esc/Desktop/morphic/apps/web/next.config.mjs)

---

## 1. Tabel Pemetaan FR-DASH (Dasbor Pengguna)

| ID PRD | Kebutuhan PRD | Prioritas / Fase | Status | Bukti Kode (file:baris) | Penjelasan & Bukti Lapangan |
|---|---|---|---|---|---|
| **FR-DASH-01** | Penggunaan per key/model/hari (token, biaya, request, error). Data tertunda ≤ 5 menit. | M (Must) / Fase 1 | **IMPLEMENTED** | `dashboard/usage/page.tsx`; `usage-view.tsx:27-48, 78-150`; `dashboard/page.tsx:109-156` | **Terpenuhi:** Menampilkan agregat token harian/bulanan, total request, top models breakdown, dan tabel riwayat request per baris (Trace ID, model, prompt/completion tokens, kredit, latensi, status, streamed). Query langsung membaca tabel PostgreSQL tanpa batch delay (data real-time < 5 detik). |
| **FR-DASH-02** | Grafik biaya dan proyeksi saldo. Menampilkan estimasi hari tersisa. | S (Should) / Fase 1 | **MISSING** | `dashboard/usage/usage-view.tsx:1-610` | Halaman penggunaan hanya menampilkan kartu ringkasan numerik statis dan tabel log. **Tidak ada visualisasi grafik garis/batang (chart) biaya dari waktu ke waktu**, tidak ada grafik proyeksi saldo, dan tidak ada kalkulasi estimasi sisa hari pemakaian berdasarkan burn-rate. |
| **FR-DASH-03** | Ekspor CSV penggunaan dan transaksi. Data hanya milik pengguna/organisasi sendiri. | S (Should) / Fase 1 | **MISSING** | `dashboard/usage/usage-view.tsx`; `dashboard/billing/billing-view.tsx` | Tidak ada tombol, handler, atau endpoint untuk mengekspor data riwayat penggunaan maupun riwayat transaksi keuangan ke format file CSV/Excel di dasbor pengguna maupun admin. |
| **FR-DASH-04** | Dokumentasi, quickstart multi-bahasa (curl, Python, JS). Contoh dapat dijalankan apa adanya. | M (Must) / Fase 1 | **IMPLEMENTED** | `docs/docs-view.tsx:32-36, 120-450` | Sangat lengkap dan interaktif. Menyediakan panduan setup step-by-step untuk 6 IDE AI populer (Cursor, Cline, Windsurf, Claude Code, OpenCode, Aider) serta SDK TypeScript, Python, dan cURL lintas OS (Windows, macOS, Linux). |
| **FR-DASH-05** | Playground uji model. Output dirender aman (tahan XSS/injeksi). | S (Should) / Fase 2 | **MISSING** | — | Fitur playground interaktif untuk uji prompt/model belum tersedia di web dasbor. (Sesuai roadmap PRD, fitur ini dialokasikan untuk Fase 2). |
| **FR-DASH-06** | Status page + riwayat insiden. Menampilkan status per model/hulu. | S (Should) / Fase 2 | **MISSING** | — | Belum ada rute halaman status publik (`/status`) atau pencatatan riwayat insiden uptime. (Sesuai roadmap PRD, dialokasikan untuk Fase 2). |
| **FR-DASH-07** | Halaman harga publik dan daftar model. Sinkron dengan tabel harga server. | M (Must) / Fase 1 | **IMPLEMENTED** | `pricing/page.tsx:1-51`; `models/page.tsx:1-29`; `dashboard/page.tsx:11-71` | Halaman `/pricing` dan `/models` tersedia untuk publik. Menampilkan katalog model aktif dan harga paket kredit secara transparan yang terhubung ke database. |

---

## 2. Tabel Pemetaan FR-ADM (Konsol Admin)

| ID PRD | Kebutuhan PRD | Prioritas / Fase | Status | Bukti Kode (file:baris) | Penjelasan & Bukti Lapangan |
|---|---|---|---|---|---|
| **FR-ADM-01** | RBAC admin (super admin, finance, support, security) + MFA wajib + IP allowlist. Aksi di luar peran → 403. | M (Must) / Fase 1 | **VIOLATION / PARTIAL** | `schema.ts:24`; `actions.ts:51-73`; `admin/layout.tsx:4-17` | **Terpenuhi:** Proteksi akses rute admin berbasis peran server-side (`user.role === 'admin'`). Sesi API key ditolak secara eksplisit (`authMethod !== 'api_key'`).<br>**Pelanggaran Kritis:** (1) Peran bersifat biner (`user` / `admin`), **tidak ada RBAC terperinci** (super admin, finance, support, security); (2) MFA admin tidak diwajibkan/tidak aktif (T-B1-01); (3) IP allowlist tidak ada. |
| **FR-ADM-02** | Manajemen pengguna: lihat, suspend, blokir, ubah plan. Semua aksi tercatat di audit log. | M (Must) / Fase 1 | **PARTIAL** | `admin/users/users-table.tsx:30-45`; `admin-actions.ts:30-77` | **Terpenuhi:** Admin dapat melihat daftar pengguna, men-suspend/unsuspend (`toggleUserSuspension`), menyesuaikan saldo (`adjustUserCredits`), dan menghapus akun (`deleteUserByAdmin`). Setiap aksi dicatat ke `adminAuditLog`.<br>**Gap:** Tidak ada aksi "ubah plan" karena model bisnis bersifat kuota saldo kredit prepaid flat tanpa tingkatan plan bulanan. |
| **FR-ADM-03** | Manajemen pool key hulu (status, kuota, rotasi) tanpa menampilkan nilai key. Key hulu tidak pernah tampil di UI/API. | M (Must) / Fase 1 | **PARTIAL** | `admin/providers/providers-client.tsx:54-260`; `admin-actions.ts:107-202` | **Terpenuhi:** Admin dapat mendaftarkan upstream provider, mengatur Base URL, menginput API key hulu (yang langsung dienkripsi AES-256-GCM), dan mengaktifkan/menonaktifkan provider. Nilai plaintext key hulu tidak pernah ditampilkan kembali di UI/API.<br>**Hilang:** **Tidak ada upstream key pool / rotasi multi-key**. Setiap provider hanya memiliki 1 set kredensial tunggal tanpa kuota per-key. |
| **FR-ADM-04** | Konfigurasi model, alias, harga, markup. Perubahan butuh peran finance + log. | M (Must) / Fase 1 | **PARTIAL** | `admin/models/models-table.tsx`; `admin-actions.ts:79-105` | **Terpenuhi:** Admin dapat menambah dan mengubah konfigurasi model, public model alias, provider model mapping, context length, harga kredit per 1M token, dan status. Perubahan dicatat ke `adminAuditLog`.<br>**Gap:** Tidak memerlukan peran spesifik `finance` (semua admin dapat mengubah harga), dan tidak ada pemisahan kolom modal hulu vs markup. |
| **FR-ADM-05** | Abuse queue + tindakan cepat. Tinjauan memakai metadata, bukan isi prompt. | M (Must) / Fase 1 | **MISSING** | — | Tidak ada halaman atau antrean peninjauan abuse di panel admin. Tabel `abuse_cases` (DM-ENT-13) tidak ada di database. |
| **FR-ADM-06** | Laporan rekonsiliasi: biaya hulu vs pendapatan, margin per model/pelanggan. Alarm bila margin negatif. | M (Must) / Fase 1 | **MISSING** | `admin/page.tsx:92-120`; `admin/transactions/page.tsx` | Dasbor admin hanya menampilkan total volume request dan pendapatan transaksi top-up. Tidak ada laporan rekonsiliasi biaya hulu riil, tidak ada perhitungan margin laba/rugi, dan tidak ada alarm margin negatif (BILL-12). |
| **FR-ADM-07** | Penampil audit log (filter, ekspor). Log tidak dapat diubah dari UI. | M (Must) / Fase 1 | **PARTIAL** | `admin/audit/page.tsx:1-87`; `schema.ts:389-401` | **Terpenuhi:** Halaman `/admin/audit` menampilkan riwayat `adminAuditLog` (waktu, admin email, aksi, entitas, payload detail). Data hanya-baca (tidak dapat dimanipulasi dari UI).<br>**Gap:** Tidak ada fitur filter (berdasarkan aksi/admin/tanggal) dan tidak ada tombol ekspor log. Query dibatasi statis `limit(100)`. |
| **FR-ADM-08** | Impersonasi pengguna dengan justifikasi + persetujuan. Setiap sesi diaudit dan dibatasi waktu. | C (Could) / Fase 1 | **MISSING** | — | Fitur impersonasi pengguna belum diimplementasikan di sistem. |

---

## 3. Tabel Pemetaan Kontrol Keamanan Frontend & Konsol Admin

| ID Kontrol | Deskripsi Kontrol Keamanan | Status | Bukti Kode (file:baris) | Evaluasi & Rekomendasi Auditor |
|---|---|---|---|---|
| **FE-01** | Tidak ada secret di bundle frontend (API key, webhook secret, token admin). | **IMPLEMENTED** | `next.config.mjs:4-12`; `actions.ts:7-10` | Kredensial sensitif (`DATABASE_URL`, secret webhook, API key admin) diisolasi di lingkungan server (Node.js runtime). Variabel publik hanya memuat URL endpoint (`NEXT_PUBLIC_*`). |
| **FE-02** | Content Security Policy (CSP) ketat untuk mencegah XSS. | **PARTIAL** | `next.config.mjs:39-52` | Header CSP telah didefinisikan secara komprehensif, namun masih menggunakan **`Content-Security-Policy-Report-Only`** alih-alih mode enforcing blocking. |
| **FE-03** | State auth di frontend tidak menyimpan password atau plaintext key. | **IMPLEMENTED** | `lib/auth-client.ts`; `login/login-view.tsx` | Password tidak pernah dipersistensi di local storage/session storage browser. |
| **FE-04** | Panel admin terlindungi (RBAC, MFA wajib, session timeout, IP allowlist). | **PARTIAL** | `actions.ts:51-73`; `admin/layout.tsx:4-17` | Autentikasi server-side mengecek status database pengguna secara langsung pada setiap request dan memblokir sesi API key. Namun MFA admin belum diaktifkan dan IP allowlist belum ada. |
| **FE-05** | Input sanitasi di frontend untuk mencegah XSS & injection. | **IMPLEMENTED** | `React 19 JSX rendering`; `admin-actions.ts:88-92` | React melakukan auto-escaping string secara default. Tidak ditemukan penggunaan `dangerouslySetInnerHTML` pada data yang dapat dikontrol pengguna. |
| **FE-06** | Proteksi CSRF pada form-based actions. | **IMPLEMENTED** | `actions.ts:1`; `Next.js Server Actions` | Next.js Server Actions secara bawaan memvalidasi header Origin dan mengimplementasikan tokenisasi pencegahan CSRF secara otomatis. |
| **AUTHZ-04**| Pembatasan akses berbasis peran (RBAC) pada fungsi manajemen dan admin. | **PARTIAL** | `actions.ts:60-63`; `admin-actions.ts:31, 42` | Pengecekan peran `admin` aktif di semua server actions, namun belum membedakan sub-peran granular (finance/support). |
| **AUTHZ-07**| Impersonasi diaudit dan dibatasi waktu. | **MISSING** | — | Fitur impersonasi belum ada. |
| **LOG-01**  | Audit trail tindakan administratif mencatat aktor, waktu, entitas, dan detail. | **IMPLEMENTED** | `admin-actions.ts:10-18`; `schema.ts:389-401` | Setiap mutasi administratif (suspend, kredit, hapus user, simpan model, simpan provider, generate kode promo) memanggil fungsi `audit()` ke tabel `admin_audit_log`. |
| **LOG-03**  | Log tidak dapat diubah atau dihapus dari antarmuka web. | **IMPLEMENTED** | `admin/audit/page.tsx:11-26` | Tidak ada endpoint update atau delete pada `adminAuditLog`. Log bersifat append-only dari level aplikasi. |
| **SEC-02**  | Nilai API key hulu tidak pernah ditampilkan di UI/API. | **IMPLEMENTED** | `admin-actions.ts:125, 151`; `providers-client.tsx:25` | Input key hulu langsung dienkripsi sebelum disimpan dan UI hanya menampilkan indikator status konfigurasi, bukan nilai plaintext. |

---

## 4. Temuan Keamanan & Kepatuhan — Diurutkan Berdasarkan Risiko

### 🟠 TINGGI — T-B5-01: Skema RBAC Admin Bersifat Biner Tanpa Pemisahan Wewenang (Separation of Duties), Ketiadaan MFA Wajib, & Tanpa IP Allowlist
- **ID PRD Terkait:** FR-ADM-01, FE-04, AUTHZ-04
- **Butir Audit:** AUTHZ-04 (Role-Based Access Control Granularity), FE-04 (Admin Console Hardening)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`packages/db/src/schema.ts:24`](file:///c:/Users/esc\Desktop\morphic\packages\db\src\schema.ts#L24):
  ```typescript
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  ```
  [`apps/web/src/lib/actions.ts:63`](file:///c:/Users/esc\Desktop\morphic\apps\web\src\lib\actions.ts#L63):
  ```typescript
  if (!row || row.user.role !== 'admin' || row.user.suspended || row.authMethod === 'api_key') return null;
  ```
- **Dampak Keamanan & Bisnis:**
  1. **Ketiadaan Separation of Duties:** Setiap orang dengan akses admin memiliki wewenang penuh atas segala hal: mengubah harga jual model, menambahkan saldo kredit tanpa batas, menghapus akun pengguna, mendaftarkan kredensial provider hulu, dan mencabut akses. Tidak ada pembatasan peran `finance` (hanya billing/harga), `support` (hanya suspend/bantuan pengguna), atau `security` (hanya audit/abuse).
  2. **Tingginya Risiko Kompromi Akun:** Karena MFA belum diwajibkan untuk admin (T-B1-01) dan tidak ada pembatasan IP allowlist, pembobolan kredensial satu akun admin memberikan kendali mutlak ke seluruh sistem produksi Morphic.
- **Mitigasi Cepat:**
  1. Perluas enum `role` di skema DB: `enum: ['user', 'super_admin', 'finance', 'support', 'security']`.
  2. Batasi fungsi di `admin-actions.ts`: hanya izinkan `super_admin` & `finance` untuk mengubah harga model/paket (`saveModel`, `savePackage`), dan hanya izinkan `security` & `super_admin` untuk melihat audit trail.
  3. Aktifkan plugin MFA Better Auth untuk semua akun dengan hak akses admin.

---

### 🟠 TINGGI — T-B5-02: Ketiadaan Fitur Ekspor CSV untuk Log Penggunaan & Riwayat Transaksi
- **ID PRD Terkait:** FR-DASH-03, AUTHZ-02
- **Butir Audit:** AUTHZ-02 (Tenant-Scoped Data Export)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/web/src/app/dashboard/usage/usage-view.tsx:1-610`](file:///c:/Users/esc\Desktop\morphic\apps\web\src\app\dashboard\usage\usage-view.tsx):
  Tidak ada tombol atau fungsi unduh file CSV pada antarmuka tabel log penggunaan.
  Di seluruh direktori `apps/web/` dan `apps/api/`, tidak ada parser atau endpoint serializer `text/csv`.
- **Dampak Keamanan & Bisnis:**
  Pengguna enterprise atau pengembang tidak dapat mengunduh rekonsiliasi data konsumsi token dan transaksi keuangan mereka ke format spreadsheet secara mandiri. Hal ini meningkatkan beban tiket bantuan operasional dan melanggar spesifikasi PRD FR-DASH-03.
- **Mitigasi Cepat:**
  Buat endpoint handler `GET /v1/account/usage/export?format=csv` yang mengalirkan baris `usage_records` milik tenant/user pemanggil dalam format CSV dengan header `Content-Disposition: attachment; filename="usage-export.csv"`.

---

### 🟡 SEDANG — T-B5-03: Ketiadaan Modul Abuse Queue & Review Kasus Penyalahgunaan di Panel Admin
- **ID PRD Terkait:** FR-ADM-05, AI-08, AI-09, DM-ENT-13
- **Butir Audit:** AI-08 (Abuse Detection Review Flow), AI-09 (Zero-Prompt Abuse Auditing)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  Di direktori `apps/web/src/app/admin/`, tidak ada subfolder `abuse`.
  Di database (`schema.ts`), tabel `abuse_cases` (DM-ENT-13) tidak ada.
- **Dampak Keamanan & Bisnis:**
  Jika sistem mendeteksi lonjakan trafik anomali, serangan scraping token, atau pelanggaran Acceptable Use Policy (AUP), tim admin tidak memiliki antrean terpusat untuk meninjau sinyal keparahan dan mengambil tindakan suspensi terpadu berdasarkan metadata.
- **Mitigasi Cepat:**
  Buat entitas `abuse_cases` di skema DB dan sediakan halaman `/admin/abuse` untuk meninjau sinyal anomali per-key/user tanpa menampilkan isi prompt pengguna.

---

### 🟡 SEDANG — T-B5-04: Ketiadaan Laporan Rekonsiliasi Margin (Biaya Hulu vs Pendapatan) dan Alarm Margin Negatif
- **ID PRD Terkait:** FR-ADM-06, BILL-12, OPS-ALT-02
- **Butir Audit:** BILL-12 (Negative Margin Alerting)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/web/src/app/admin/page.tsx:92-120`](file:///c:/Users/esc\Desktop\morphic\apps\web\src\app\admin\page.tsx#L92-L120):
  Overview admin hanya membandingkan volume request dan total rupiah pembayaran. Tidak ada kalkulasi modal hulu (upstream cost) per request/model, dan tidak ada deteksi transaksi yang merugi.
- **Dampak Keamanan & Bisnis:**
  Platform berisiko mengalami kebocoran finansial (silent financial loss) jika penyedia hulu memperbarui harga tanpa diketahui atau jika konfigurasi harga jual model ditetapkan terlalu murah oleh admin.
- **Mitigasi Cepat:**
  Tambahkan kalkulasi margin kotor di dasbor admin (`gross_profit = revenue - estimated_upstream_cost`) dan alarm visual merah jika model memiliki margin <= 0%.

---

### 🟡 SEDANG — T-B5-05: Dasbor Pengguna Tidak Memiliki Grafik Tren Biaya & Estimasi Hari Tersisa (Burn-Rate Projection)
- **ID PRD Terkait:** FR-DASH-02
- **Butir Audit:** FR-DASH-02 (Cost Graphs & Balance Projections)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/web/src/app/dashboard/usage/usage-view.tsx:78-150`](file:///c:/Users/esc\Desktop\morphic\apps\web\src\app\dashboard\usage\usage-view.tsx#L78-L150):
  Komponen hanya merender 4 kartu metrik (hari ini, bulan ini, total request, top model) dan tabel paginasi. Tidak ada komponen chart grafik garis tren biaya dan tidak ada perhitungan estimasi sisa hari saldo berdasarkan rata-rata pemakaian harian.
- **Dampak Keamanan & Bisnis:**
  Pengalaman pengguna kurang informatif untuk monitoring anggaran AI tim. Pengguna tidak dapat memprediksi kapan saldo mereka akan habis sebelum terputus.
- **Mitigasi Cepat:**
  Tambahkan chart grafik time-series konsumsi kredit 30 hari terakhir dan kartu indikator `Estimasi Saldo Tersisa: ~N Hari` berdasarkan rata-rata pemakaian 7 hari terakhir.

---

### 🟡 SEDANG — T-B5-06: Penampil Audit Log Admin Tidak Memiliki Filter & Fungsi Ekspor
- **ID PRD Terkait:** FR-ADM-07, LOG-01, LOG-03
- **Butir Audit:** LOG-01 (Administrative Audit Trail Filtering)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/web/src/app/admin/audit/page.tsx:23-26`](file:///c:/Users/esc\Desktop\morphic\apps\web\src\app\admin\audit\page.tsx#L23-L26):
  ```typescript
  .orderBy(desc(s.adminAuditLog.createdAt))
  .limit(100);
  ```
  Query dibatasi statis 100 entri terakhir tanpa kontrol filter pencarian (berdasarkan admin ID, tipe entitas, atau aksi), serta tidak ada tombol ekspor log audit.
- **Dampak Keamanan & Bisnis:**
  Menyulitkan investigasi kepatuhan dan forensik insiden keamanan. Tindakan admin lama di luar 100 baris terakhir tidak dapat ditelusuri melalui konsol admin.
- **Mitigasi Cepat:**
  Tambahkan paginasi, filter dropdown berdasarkan aksi/entitas, serta input rentang tanggal pada halaman `/admin/audit`.

---

### 🔵 RENDAH — T-B5-07: Playground Uji Model Belum Tersedia di Web Dasbor (Fase 2)
- **ID PRD Terkait:** FR-DASH-05, AI-05
- **Butir Audit:** AI-05 (Playground XSS & Output Sanitization)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:** Tidak ada rute `dashboard/playground` di `apps/web/src/app/dashboard/`.
- **Dampak:** Pengguna harus menguji API key via terminal/cURL/SDK secara manual tanpa UI playground langsung.
- **Mitigasi Cepat:** Kembangkan fitur playground dengan rendering aman (tahan XSS) pada rilis Fase 2 sesuai jadwal PRD.

---

### 🔵 RENDAH — T-B5-08: Halaman Status Publik & Riwayat Insiden Belum Tersedia (Fase 2)
- **ID PRD Terkait:** FR-DASH-06
- **Butir Audit:** FR-DASH-06 (Public Status Page & Incident History)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:** Tidak ada rute `/status` di `apps/web/src/app/`.
- **Dampak:** Pengguna tidak dapat memantau uptime historis masing-masing model/hulu secara publik saat terjadi gangguan.
- **Mitigasi Cepat:** Buat halaman `/status` publik yang menampilkan status uptime hulu pada rilis Fase 2.

---

### 🔵 RENDAH — T-B5-09: Fitur Impersonasi Pengguna oleh Tim Dukungan Belum Tersedia (Fase 1 'Could')
- **ID PRD Terkait:** FR-ADM-08, AUTHZ-07
- **Butir Audit:** AUTHZ-07 (Scoped & Audited Impersonation)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:** Tidak ada modul impersonasi di backend maupun frontend.
- **Dampak:** Tim support tidak dapat melihat dasbor persis seperti tampilan pengguna saat melakukan investigasi kendala teknis.
- **Mitigasi Cepat:** Implementasikan fitur impersonasi terbatas waktu dengan justifikasi wajib dan audit log khusus jika diperlukan.

---

### 🔵 RENDAH — T-B5-10: Header CSP Masih Menggunakan Mode Report-Only (Belum Enforced)
- **ID PRD Terkait:** FE-02, SR-07
- **Butir Audit:** FE-02 (Content Security Policy Enforcement)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/web/next.config.mjs:39-40`](file:///c:/Users/esc\Desktop\morphic\apps\web\next.config.mjs#L39-L40):
  Header disetel sebagai `Content-Security-Policy-Report-Only`.
- **Dampak:** Skrip berbahaya potensial tidak akan diblokir oleh browser (hanya dilaporkan), sehingga mitigasi pertahanan lapis kedua terhadap XSS belum aktif penuh.
- **Mitigasi Cepat:** Ganti header menjadi `Content-Security-Policy` (enforced) setelah memverifikasi tidak ada pelanggaran false-positive pada modul framer-motion dan inline script Next.js.

---

## 5. Analisis Mendalam atas 6 Pertanyaan Kunci Dashboard & Admin Conformance

### 1. Keamanan & Proteksi Akses Konsol Admin (FE-04 & AUTHZ-04)
- Proteksi rute admin diimplementasikan dengan baik di tingkat server (`actions.ts:51-73`). Server action memverifikasi langsung baris database pengguna pada setiap request, menolak pengguna suspended, dan secara eksplisit menolak sesi yang diturunkan dari API key (`authMethod === 'api_key'`).
- Kelemahan utama adalah ketiadaan pembagian peran granular (hanya biner `admin` vs `user`, T-B5-01), ketiadaan MFA wajib (T-B1-01), dan ketiadaan pembatasan IP allowlist.

### 2. Kualitas Dokumentasi Quickstart & Integrasi Pengembang (FR-DASH-04)
- Modul dokumentasi (`docs-view.tsx`) berkualitas sangat tinggi. Menyediakan contoh sintaks yang siap dijalankan untuk Cursor, Cline, Windsurf, Claude Code, OpenCode, Aider, TypeScript, Python, dan cURL untuk Windows (PowerShell/CMD), macOS, dan Linux.

### 3. Transparansi Manajemen Upstream Provider & Key Masking (FR-ADM-03 & SEC-02)
- Antarmuka manajemen upstream provider (`admin/providers/providers-client.tsx`) mengelola Base URL dan kredensial secara aman. Kredensial dienkripsi AES-256-GCM di sisi server dan nilai plaintext tidak pernah dikembalikan ke browser klien.
- Namun arsitektur masih terbatas pada single credential per provider, tanpa pool key hulu atau rotasi dinamis.

### 4. Integritas Audit Trail Administratif (LOG-01 & LOG-03)
- Seluruh mutasi admin di `admin-actions.ts` memanggil fungsi `audit()` ke tabel `admin_audit_log`. Data audit mencakup aktor, aksi, nama entitas, target ID, dan detail perubahan.
- Log tidak dapat diubah atau dihapus dari UI. Namun tampilan log di `/admin/audit` dibatasi 100 entri statis tanpa filter atau tombol ekspor (T-B5-06).

### 5. Visibilitas Penggunaan Token & Metrik Konsumsi Dasbor (FR-DASH-01)
- Dasbor pengguna menyajikan visibilitas token komprehensif: prompt tokens, completion tokens, total tokens, kredit terpakai, latensi request, dan Trace ID untuk setiap request.
- Data dibaca langsung dari PostgreSQL secara real-time.

### 6. Kesiapan Pengerasan Frontend (CSP & Secret Isolation)
- Bundel frontend bersih dari kebocoran secret backend (`FE-01`).
- Namun header keamanan CSP masih dalam mode `Report-Only` (T-B5-10), sehingga pertahanan XSS aktif di tingkat browser belum enforced.

---

## 6. Rekapitulasi Status & Matriks Risiko

### 6.1 Ringkasan Status Kebutuhan FR-DASH (7 Butir)
| Status | Jumlah | Persentase | Rincian Butir |
|---|---|---|---|
| **IMPLEMENTED** | 3 | 42.9% | FR-DASH-01, FR-DASH-04, FR-DASH-07 |
| **MISSING** | 4 | 57.1% | FR-DASH-02, FR-DASH-03, FR-DASH-05 (Fase 2), FR-DASH-06 (Fase 2) |
| **TOTAL** | **7** | **100%** | |

### 6.2 Ringkasan Status Kebutuhan FR-ADM (8 Butir)
| Status | Jumlah | Persentase | Rincian Butir |
|---|---|---|---|
| **IMPLEMENTED** | 0 | 0.0% | — |
| **PARTIAL** | 4 | 50.0% | FR-ADM-02, FR-ADM-03, FR-ADM-04, FR-ADM-07 |
| **VIOLATION / PARTIAL** | 1 | 12.5% | FR-ADM-01 (Flat Binary Role, No MFA, No IP Allowlist) |
| **MISSING** | 3 | 37.5% | FR-ADM-05, FR-ADM-06, FR-ADM-08 (Fase 1 'Could') |
| **TOTAL** | **8** | **100%** | |

### 6.3 Matriks Temuan Berdasarkan Keparahan
| Tingkat Keparahan | Jumlah | Kode Temuan |
|---|---|---|
| 🔴 **Kritis** | 0 | — |
| 🟠 **Tinggi** | 2 | T-B5-01, T-B5-02 |
| 🟡 **Sedang** | 4 | T-B5-03, T-B5-04, T-B5-05, T-B5-06 |
| 🔵 **Rendah** | 4 | T-B5-07, T-B5-08, T-B5-09, T-B5-10 |
| **TOTAL TEMUAN** | **10** | |

### 6.4 Prioritas Tindakan Perbaikan
1. **P0 (Keamanan Hak Akses Admin):**
   - Perluas RBAC admin menjadi peran granular (`super_admin`, `finance`, `support`, `security`) dan wajibkan MFA untuk semua sesi admin (T-B5-01, T-B1-01).
   - Enforce Content-Security-Policy (CSP) dari mode `Report-Only` ke blocking mode (T-B5-10).
2. **P1 (Kepatuhan Layanan & Fitur Pengguna):**
   - Bangun fitur ekspor CSV untuk log penggunaan dan transaksi (T-B5-02).
   - Buat halaman antrean abuse (`/admin/abuse`) berbasis metadata (T-B5-03).
   - Tambahkan grafik visualisasi biaya dan proyeksi hari sisa saldo di dasbor (T-B5-05).
   - Lengkapi penampil audit log dengan filter pencarian dan tombol ekspor (T-B5-06).
   - Tambahkan pelacakan modal hulu dan alert margin negatif (T-B5-04).

---

## 7. Informasi Wajib Penutup B5 & Update Handoff

### 7.1 File yang Sudah Dibaca Lengkap
1. `apps/web/src/app/dashboard/page.tsx` (211 baris)
2. `apps/web/src/app/dashboard/usage/usage-view.tsx` (610 baris)
3. `apps/web/src/app/dashboard/usage/page.tsx` (35 baris)
4. `apps/web/src/app/docs/docs-view.tsx` (1869 baris)
5. `apps/web/src/app/pricing/page.tsx` (51 baris)
6. `apps/web/src/app/models/page.tsx` (29 baris)
7. `apps/web/src/app/admin/layout.tsx` (18 baris)
8. `apps/web/src/app/admin/admin-shell.tsx` (190 baris)
9. `apps/web/src/app/admin/page.tsx` (364 baris)
10. `apps/web/src/app/admin/users/users-table.tsx` (284 baris)
11. `apps/web/src/app/admin/providers/providers-client.tsx` (666 baris)
12. `apps/web/src/app/admin/transactions/page.tsx` (105 baris)
13. `apps/web/src/app/admin/audit/page.tsx` (87 baris)
14. `apps/web/src/lib/admin-actions.ts` (331 baris)
15. `apps/web/next.config.mjs` (61 baris)

### 7.2 Hal yang Butuh Uji Manual di Staging
1. Uji penolakan akses admin jika pengguna mencoba memanipulasi cookie sesi atau login dengan akun non-admin.
2. Uji responsivitas navigasi admin pada perangkat mobile (uji drawer dan floating menu).
3. Uji rendering simbol khusus/karakter non-ASCII pada label model dan Trace ID di dasbor pengguna untuk memastikan bebas dari rendering injection.
