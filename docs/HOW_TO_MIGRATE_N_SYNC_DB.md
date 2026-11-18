# Panduan Lengkap Migrasi & Failover Database: Neon Primary ↔ PostgreSQL Lokal

Dokumen ini dibagi menjadi dua skenario utama agar jelas dari awal hingga akhir:
1. **[Section 1 — Primary (Neon) → Fallback (PostgreSQL Lokal)](#section-1--primary-neon--fallback-postgresql-lokal)**: dipakai sebagai cadangan harian dan saat Neon terkena kuota limit.
2. **[Section 2 — Fallback (PostgreSQL Lokal) → Primary (Neon)](#section-2--fallback-postgresql-lokal--primary-neon-saat-limit-selesai)**: dipakai untuk memulihkan data transaksi ke Neon ketika kuota/limit sudah reset.

---

## Section 1 — Primary (Neon) → Fallback (PostgreSQL Lokal)

### 1.1 Cara Kerja

Selama sistem berjalan normal dengan Neon sebagai database utama (`activeTarget=primary`), aplikasi menjaga PostgreSQL lokal tetap sinkron lewat 4 mekanisme (`packages/db/src/index.ts`, `packages/db/src/sync.ts`, `apps/api/src/lib/db-failover-monitor.ts`, `apps/api/src/lib/db-sync-queue.ts`):

1. **Startup Self-Check & Sync on Boot (`DB_SYNC_ON_BOOT`)**
   - 3 detik setelah API menyala, `scheduleStartupSelfCheck()` memeriksa konektivitas, izin role, jumlah/hash migrasi Drizzle, dan parity antara Neon vs lokal.
   - Jika Postgres lokal belum siap (unreachable, izin kurang, atau migrasi belum cocok), server mengirim alert Telegram dan **tidak** menjalankan sync.
   - Jika sehat dan Neon online, `runFallbackSyncJob('boot')` menjalankan `syncPrimaryToFallback({ skipLogs: true })` (dikelola lease `runLeased` agar tidak bentrok antar node).

2. **Sync on Write untuk Transaksi Kritis (`DB_SYNC_ON_WRITE`)**
   - Tepat setelah transaksi **payment** (`apps/api/src/lib/notify.ts`, `apps/api/src/routes/webhooks.ts`) atau **redeem** (`apps/api/src/handlers/redeem.ts`) commit di Neon, API memanggil `scheduleTargetedSync()` secara *fire-and-forget* (tidak memblokir response user).
   - Antrean melakukan debounce (`1500 ms`), mencoba `syncTargetedToFallback` (hanya menyalin baris user/payment/redeem terkait), retry `1×` setelah `2000 ms`, dan otomatis eskalasi ke `syncPrimaryToFallback({ skipLogs: true })` jika gagal. Jika tetap gagal, alert `GIVE-UP` dikirim ke Telegram.

3. **Sync Periodik (`DB_SYNC_INTERVAL_MS`)**
   - Setiap 10 menit (default `600000 ms`), job terjadwal di `apps/api/src/index.ts` menjalankan `syncPrimaryToFallback({ skipLogs: true })` untuk menjaga seluruh tabel tetap up-to-date.
   - Seluruh job sync (targeted, boot, periodic, escalation) memakai mutex serial `runExclusiveSync` agar tidak pernah tumpang tindih.

4. **Auto-Failover Sticky (`DB_FAILOVER_ENABLED`)**
   - Proxy `db` dan `withTransaction()` di `packages/db/src/index.ts` mendeteksi error kuota/koneksi Neon lewat `isNeonFailoverError()` (mis. kuota habis, HTTP `402`/`429`/`502`/`503`/`504`, `ECONNREFUSED`, `ETIMEDOUT`, PG code `53300`/`08*`/`57P*`). Error SQL aplikasi (mis. constraint `23*`, `InsufficientCreditsError`) **tidak** memicu failover.
   - Begitu sekali failover aktif:
     - Target berpindah menjadi `fallback` secara **sticky** di memori proses sampai server direstart atau mode dipaksa via env.
     - Semua job `primary → fallback` yang sedang berjalan otomatis dibatalkan (`SyncAbortedError`) agar data baru di lokal tidak pernah tertimpa data Neon yang tertinggal.
     - API mengirim alert Telegram `🚨 [DB FAILOVER]` beserta ringkasan parity terakhir.

**Cara copy per jenis tabel (`SYNC_PLAN` di `packages/db/src/sync.ts`):**
- **Tabel `upsert`** (`users`, `balances`, `payments`, `entitlements`, `reservations`, `packages`, `models`, `providers`, dll): disalin berdasarkan PK dengan `ON CONFLICT (pk) DO UPDATE`.
- **Tabel `append_watermark`** (`admin_audit_log`, `usage_records`, `payment_events`, `credit_ledger`, `request_logs`): membaca `max(created_at)` di tujuan, mundur 60 menit (*overlap window*), lalu `INSERT ... ON CONFLICT DO NOTHING`.
- **Tidak pernah menghapus row:** sync `primary → fallback` tidak menjalankan `DELETE` pada tabel tujuan.

---

### 1.2 Variabel `.env` / `.env.production` untuk Primary → Fallback

| Variabel | Contoh / Nilai | Fungsi |
|---|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require` | Koneksi Neon Primary |
| `DATABASE_URL_FALLBACK` | `postgresql://morphic_app:...@127.0.0.1:5432/morphic?sslmode=disable` | Koneksi PostgreSQL Lokal (jika kosong, sync & failover mati total) |
| `DB_FAILOVER_ENABLED` | `true` *(default aktif bila fallback diset)* | Izinkan auto-failover saat Neon error kuota/jaringan (`false` untuk mematikan) |
| `DB_FORCE_FALLBACK` | `false` *(ubah ke `true` saat Neon limit!)* | Memaksa API langsung memakai Postgres lokal sejak boot |
| `DB_SYNC_ON_BOOT` | `true` *(default aktif)* | Jalankan parity self-check + sync awal 3 detik setelah boot (`false` untuk matikan boot sync) |
| `DB_SYNC_ON_WRITE` | `true` *(default aktif)* | Mirror payment & redeem secara langsung setelah commit (`false` untuk matikan) |
| `DB_SYNC_ON_WRITE_DEBOUNCE_MS` | `1500` *(default `1500`)* | Jeda debounce antrean targeted sync dalam milidetik |
| `DB_SYNC_INTERVAL_MS` | `600000` *(default `600000` = 10 menit)* | Interval sync periodik (`0` untuk mematikan sync periodik) |

> [!IMPORTANT]
> **Yang wajib diubah di `.env` / `.env.production` saat Neon resmi masuk masa limit:**
> ```env
> DB_FORCE_FALLBACK=true
> ```
> **Kenapa wajib?** Tanpa `DB_FORCE_FALLBACK=true`, jika proses API restart di tengah bulan atau tepat ketika Neon baru reset sesaat, API akan boot dalam mode `primary` dan menjalankan `boot sync` (`Neon → Local`) yang bisa menimpa data baru di PostgreSQL lokal atau kembali membakar kuota Neon.

---

### 1.3 Prasyarat Migrasi & Izin PostgreSQL Lokal (Setup Awal Fallback)

Sebelum fallback bisa dipakai, PostgreSQL lokal harus memiliki skema Drizzle yang sama persis dengan Neon dan role aplikasi harus punya hak baca/tulis:

1. **Jalankan migrasi Drizzle ke PostgreSQL lokal:**
   `packages/db/drizzle.config.ts` membaca `process.env.DATABASE_URL` (dengan `dotenv` yang tidak menimpa variabel shell). Untuk memigrasi database lokal tanpa mengubah file `.env`, set `DATABASE_URL` di shell sementara:
   ```bash
   DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/morphic?sslmode=disable" pnpm db:migrate
   ```
2. **Pastikan role `DATABASE_URL_FALLBACK` punya izin `USAGE` di schema `public` dan `SELECT, INSERT, UPDATE, DELETE` di semua tabel**, lalu cek dengan `pnpm db:parity --no-fail` sampai muncul:
   ```text
   Fallback Host: 127.0.0.1:5432 (ONLINE, perms=OK)
   Migrations:    MATCH (primary=..., fallback=...)
   ```

---

### 1.4 Daftar Perintah CLI (Primary → Fallback & Cek Parity)

#### A. `pnpm db:parity` (`packages/db/src/cli-parity.ts`)
Memeriksa konektivitas kedua DB, permission lokal, kecocokan migrasi Drizzle, 26 tabel skema, lag maksimum, dan kecocokan finansial/auth (`balances`, `payments`, `credit_ledger`, `api_keys`).

| Perintah | Keterangan |
|---|---|
| `pnpm db:parity` | Tampilkan laporan tabel & finansial lengkap; **exit 1** jika `isCriticalMatch` = `false` (DRIFT) |
| `pnpm db:parity --no-fail` | Sama, namun tetap **exit 0** walaupun masih DRIFT (cocok untuk monitoring manual / saat Neon offline) |
| `pnpm db:parity --json` | Output laporan dalam format JSON |

#### B. `pnpm db:sync-fallback` (`packages/db/src/cli-sync.ts`)
Menyalin data secara manual satu arah **Neon Primary → Local Fallback**, lalu otomatis mencetak laporan parity sesudahnya.

| Flag | Keterangan |
|---|---|
| *(tanpa flag)* | Sync incremental (tabel append pakai watermark `max(created_at) - 60m`) termasuk `request_logs` |
| `--dry-run` | Simulasi: hanya menghitung row yang akan dibaca, **tidak menulis** ke Postgres lokal |
| `--skip-logs` | Lewati tabel `request_logs` (lebih cepat karena log request paling besar) |
| `--force-full` | Abaikan watermark pada tabel append; scan seluruh row dari awal untuk menambal gap lama |
| `--json` | Output ringkasan sync + parity sesudah sync dalam format JSON |

---

### 1.5 Urutan Operasional Saat Neon Mulai Limit

1. Cek apakah alert failover sudah masuk di Telegram (`🚨 [DB FAILOVER] ...`), atau cek `pnpm db:parity --no-fail`.
2. Tambahkan / ubah di `.env` / `.env.production`:
   ```env
   DB_FORCE_FALLBACK=true
   ```
3. Restart API agar status `activeTarget=fallback` permanen sejak boot. Pastikan log startup menampilkan:
   ```text
   [db-sync] startup ... activeTarget=fallback ...
   [db-sync] startup WARNING: DB_FORCE_FALLBACK=true — serving from the fallback DB; primary->fallback syncing is DISABLED
   ```
4. Selama masa `DB_FORCE_FALLBACK=true`, **jangan** ubah data di dashboard Neon secara langsung. Semua transaksi user berjalan normal di PostgreSQL lokal.

---
---

## Section 2 — Fallback (PostgreSQL Lokal) → Primary (Neon) *(Saat Limit Selesai)*

### 2.1 Cara Kerja

Ketika kuota Neon sudah reset bulan depan, data transaksi yang menumpuk di PostgreSQL lokal selama masa limit dipindahkan balik ke Neon menggunakan CLI **semi-otomatis** `pnpm db:sync-to-primary` (`packages/db/src/cli-sync-to-primary.ts` → `syncFallbackToPrimary()` di `packages/db/src/sync.ts`).

**Kenapa sengaja dibuat semi-otomatis (bukan otomatis di background)?**
- Mencegah *split-brain* jika Neon hanya pulih sebentar lalu gagal lagi di tengah jalan.
- Memberi kesempatan operator menghentikan write sebentar, melihat diff parity terlebih dahulu, dan mengonfirmasi penulisan ke database production Neon.

**Yang terjadi saat `pnpm db:sync-to-primary` dijalankan:**
1. **Guard Statis (sebelum membuka koneksi DB):**
   - Memastikan flag CLI valid (`parseArgs` dengan `strict: true`; flag typo/asing langsung `exit 1`).
   - Memastikan `DATABASE_URL_FALLBACK` ada dan tidak identik dengan `DATABASE_URL`.
   - Untuk mode live write, mewajibkan konfirmasi interaktif `"yes"` (atau `--yes`); jika dijalankan non-interaktif / `--json` tanpa `--yes`, script langsung `exit 1`.
2. **Pre-Flight Check & Pre-Sync Parity (`checkDatabaseParity`):**
   - Mengecek `primaryReachable` (Neon sudah online), `fallbackReachable`, `fallbackPermissionsOk`, dan `migrationsMatch`.
   - Jika seluruh jumlah row & saldo per user sudah `EXACT MATCH` (dan tidak pakai `--force-full`), script berhenti tanpa menulis ke Neon.
   - Jika ada tabel `upsert` yang jumlah row lokalnya **lebih banyak** daripada Neon (`deltaRows < 0`, misalnya `packages` atau `sessions`), CLI menampilkan peringatan **`Reverse upsert notice`** sebelum prompt konfirmasi.
3. **Eksekusi Copy (Local → Neon, urutan FK Tier 1 → Tier 5):**
   - Tabel `upsert`: membaca dari lokal dan menulis ke Neon dengan `ON CONFLICT (pk) DO UPDATE` (data lokal terbaru menimpa data Neon yang tertinggal).
   - Tabel `append_watermark`: membaca row sejak `max(created_at) - 60 menit` milik Neon (atau semua row jika `--force-full`), lalu menulis dengan `ON CONFLICT DO NOTHING`.
   - **Tidak pernah menjalankan `DELETE`** di Neon.
4. **Post-Sync Parity:**
   - Otomatis menjalankan `checkDatabaseParity()` lagi sesudah sync selesai dan memberi hint `--force-full` jika tabel append masih memiliki gap historis yang lebih tua dari timestamp terakhir di Neon.

> [!WARNING]
> **Perhatian Khusus: Asimetri Row Terhapus & Unique Constraint Non-PK (`packages`, dll.)**
> Karena sync tidak pernah menghapus row:
> - Jika di masa lalu ada row yang **sudah dihapus di Neon**, tetapi masih tersisa di PostgreSQL lokal (mis. `packages` lokal ada `20` row sedangkan Neon `9` row), menjalankan `sync-to-primary` akan **meng-upsert seluruh 20 row lokal ke Neon** (memunculkan kembali 11 paket lama, **atau gagal dengan error `[23505] duplicate key value violates unique constraint "packages_name_unique"`** jika ada row berbeda `id` tetapi sama `name`).
> - Jika hal ini terjadi, bersihkan dulu row stale di tabel lokal terkait (atau selesaikan duplikatnya), baru ulangi `pnpm db:sync-to-primary`.

---

### 2.2 Variabel `.env` / `.env.production` untuk Cutover Balik

**Kapan mengubah `.env` sangat krusial!**

- **SEBELUM & SELAMA menjalankan `pnpm db:sync-to-primary`:**
  **TETAP pertahankan:**
  ```env
  DB_FORCE_FALLBACK=true
  ```
  Jangan ubah ke `false` dulu! `pnpm db:sync-to-primary` tetap membaca `DATABASE_URL` (Neon) dan `DATABASE_URL_FALLBACK` (Lokal) secara langsung meskipun `DB_FORCE_FALLBACK=true`. Membiarkannya `true` menjamin jika API tidak sengaja menyala, API tidak akan menimpa lokal dari Neon.

- **SETELAH `pnpm db:sync-to-primary` dan `pnpm db:parity` selesai & cocok:**
  Barulah ubah di `.env` / `.env.production`:
  ```env
  DB_FORCE_FALLBACK=false
  ```
  *(atau hapus baris `DB_FORCE_FALLBACK`), pastikan juga `DB_FAILOVER_ENABLED=true`, `DB_SYNC_ON_WRITE=true`, `DB_SYNC_ON_BOOT=true`, dan `DB_SYNC_INTERVAL_MS=600000` aktif, lalu start ulang API.*

---

### 2.3 Daftar Perintah CLI (Fallback → Primary)

#### `pnpm db:sync-to-primary` (`packages/db/src/cli-sync-to-primary.ts`)

| Flag | Default | Fungsi |
|---|---|---|
| `--dry-run` | `false` | Pre-sync parity + hitung jumlah row yang akan ditarik **tanpa menulis ke Neon** |
| `--skip-logs` | `false` | Lewati tabel `request_logs` agar sinkronisasi tabel auth & finansial selesai cepat |
| `--force-full` | `false` | Abaikan watermark `max(created_at)` pada tabel append (menambal gap historis) & tetap jalankan sync walau hitungan row `EXACT MATCH` |
| `--yes` | `false` | Lewati prompt konfirmasi `"Type 'yes' to proceed"` |
| `--json` | `false` | Output JSON (`preParity` + `syncReport`); untuk live write **wajib** digabung dengan `--yes` |
| `-- --help` | `false` | Menampilkan ringkasan bantuan CLI (gunakan `--` agar tidak dicegat oleh `pnpm`) |

---

### 2.4 Prosedur Lengkap Langkah-demi-Langkah (Saat Limit Neon Selesai)

```mermaid
flowchart TD
    A["1. Pastikan DB_FORCE_FALLBACK=true masih aktif"] --> B["2. Cek Neon ONLINE & migrasi MATCH:<br/>pnpm db:parity --no-fail"]
    B --> C["3. Stop proses API sementara<br/>(hentikan write baru ke Postgres lokal)"]
    C --> D["4. Jalankan dry-run:<br/>pnpm db:sync-to-primary --dry-run"]
    D --> E["5. Jalankan live sync:<br/>pnpm db:sync-to-primary"]
    E --> F{"6. Tabel append masih DRIFT?"}
    F -- "Ya (ada gap lama)" --> G["Jalankan:<br/>pnpm db:sync-to-primary --force-full"]
    G --> H["7. Verifikasi akhir:<br/>pnpm db:parity"]
    F -- "Tidak" --> H
    H --> I["8. Ubah DB_FORCE_FALLBACK=false di .env<br/>& nyalakan ulang API"]
```

1. **Verifikasi kondisi awal & cek Neon sudah online:**
   Pastikan `.env` masih memakai `DB_FORCE_FALLBACK=true`, lalu jalankan:
   ```bash
   pnpm db:parity --no-fail
   ```
   Pastikan `Primary Host` sudah `ONLINE`, `Fallback Host` `ONLINE, perms=OK`, dan `Migrations: MATCH`. Jika `Migrations` berbeda, samakan dulu dengan `pnpm db:migrate`.

2. **Hentikan server API sementara (maintenance singkat):**
   Stop proses API (mis. `pm2 stop morphic-api` atau proses Node yang berjalan) supaya tidak ada transaksi baru masuk ke Postgres lokal sementara data sedang disalin ke Neon.

3. **Simulasi dulu dengan `--dry-run`:**
   ```bash
   pnpm db:sync-to-primary --dry-run
   ```
   Perhatikan:
   - Total row yang akan ditarik.
   - Apakah ada tabel `upsert` dengan `deltaRows < 0` (seperti `packages` atau `sessions`). Bila ada row lama di lokal yang memang tidak ingin dibangkitkan lagi di Neon, bersihkan dari lokal terlebih dahulu sebelum step 4.

4. **Jalankan sinkronisasi live Local → Neon:**
   ```bash
   pnpm db:sync-to-primary
   ```
   *(Jika `request_logs` sangat besar dan ingin mendahulukan data transaksi/saldo dulu, bisa jalankan `pnpm db:sync-to-primary --skip-logs`, lalu lanjutkan `pnpm db:sync-to-primary` penuh setelahnya.)*
   Saat diminta konfirmasi, tinjau target source/destination lalu ketik `yes`.

5. **Jalankan `--force-full` bila masih ada gap historis pada tabel append:**
   Jika post-sync parity masih menunjukkan selisih pada `credit_ledger`, `payment_events`, `usage_records`, `request_logs`, atau `admin_audit_log` (karena ada gap sebelum `max(created_at)` di Neon), jalankan:
   ```bash
   pnpm db:sync-to-primary --force-full
   ```

6. **Validasi parity akhir:**
   ```bash
   pnpm db:parity
   ```
   Pastikan bagian `Financial & Auth Integrity` menunjukkan `delta=0` untuk Total Credits Balance, Paid Payments, Credit Ledger Entries, dan Active API Keys, serta verdict sudah `EXACT MATCH` atau `CRITICAL MATCH`.

7. **Aktifkan kembali Neon Primary di `.env` & nyalakan API:**
   Ubah `.env` / `.env.production`:
   ```env
   DB_FORCE_FALLBACK=false
   ```
   Lalu nyalakan ulang proses API. Cek log startup API harus kembali ke mode normal:
   ```text
   [db-sync] startup primary=ep-...neon.tech fallback=127.0.0.1:5432 activeTarget=primary failover=on syncOnWrite=on debounceMs=1500 periodicIntervalMs=600000 syncOnBoot=on
   [db-sync] startup check primary=ONLINE fallback=ONLINE permissions=ok migrations=match parity=...
   ```

---

## Section 3 — Troubleshooting & Aturan Larangan

| Situasi / Error | Penyebab & Cara Mengatasi |
|---|---|
| Jangan restart API ke `DB_FORCE_FALLBACK=false` sebelum `db:sync-to-primary` selesai | `runStartupSelfCheck` & `runPeriodicFallbackSync` otomatis menjalankan `syncPrimaryToFallback`, sehingga Neon yang datanya tertinggal akan menimpa data baru di Postgres lokal. |
| `[23505] duplicate key value violates unique constraint "..."` saat `sync-to-primary` | Ada dua row berbeda `id` (PK) antara lokal dan Neon yang memiliki nilai kolom `UNIQUE` sama (mis. `packages.name`, `users.email`, `redeem_codes.code`). Selesaikan duplikat di Postgres lokal, lalu jalankan ulang `pnpm db:sync-to-primary` (aman diulang karena idempotent). |
| `Live sync in non-interactive/--json mode requires --yes` | Menjalankan live write tanpa TTY interaktif atau memakai `--json` tanpa `--yes`. Gunakan `--dry-run` untuk simulasi atau tambahkan `--yes` jika yakin menulis ke Neon. |
| `Row counts & balances already match (EXACT MATCH)` padahal ada perubahan isi kolom | `checkDatabaseParity` membandingkan jumlah row & saldo `balances`, bukan isi kolom non-saldo (mis. revokasi `api_keys` atau update profil `users`), serta mengecualikan `sessions` dan `job_leases`. Gunakan `pnpm db:sync-to-primary --force-full` untuk memaksa upsert seluruh row. |
| `Unknown option '...'` | `cli-sync-to-primary.ts` memakai `parseArgs` dengan `strict: true` agar typo flag (mis. `--dryrun`) tidak pernah salah mengeksekusi mode live. Cek ejaan flag dengan `pnpm db:sync-to-primary -- --help`. |
