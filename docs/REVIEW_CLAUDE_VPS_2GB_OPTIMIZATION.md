# Review Analisa Claude: Optimisasi Routing `apps/api` untuk VPS Android/Debian (RAM 2 GB)

Dokumen ini merangkum hasil analisa Claude terkait optimisasi `apps/api` untuk VPS Android/Debian ber-RAM 2 GB, disertai komentar teknis dan verifikasi langsung terhadap codebase Morphic pada setiap poinnya.

---

## Ringkasan Awal Claude

> Router provider (`domain/router.ts`) sudah efisien: data routing di-cache di memori 30 detik, credential juga di-cache, dan pemilihan provider tidak query DB. Beban terbesar ada di middleware sebelum dan sesudah router.

### Komentar

- **Akurat untuk sisi router.** `apps/api/src/domain/router.ts` memang memuat snapshot (`models`, `providers`, `model_provider_pool`) dengan TTL default 30 detik (`DEFAULT_ROUTER_CACHE_TTL_MS = 30_000`), mendukung *stale-if-error*, dan menyimpan decrypted credentials di `credentialCache`.
- **Catatan yang terlewat di hot path:** Beban DB terbesar bukan hanya di middleware auth, tetapi juga pada alur billing di `apps/api/src/domain/completion.ts` (`reserve()` yang memakai transaksi DB melalui Neon WS Pool, `settle()`, dan `logRequest()`). Jadi, mengoptimalkan middleware auth akan sangat memangkas latency, namun total DB round-trip per inference request tetap tidak menjadi 0.

---

## Prioritas Tinggi

### 1. Auth melakukan 3 query DB berurutan per request

**Pernyataan Claude** (`apps/api/src/middleware/auth.ts:62-92`):
- Query 1: `SELECT` `api_keys`. Query 2: `SELECT` `users.suspended`. Query 3: `UPDATE lastUsedAt` yang ditunggu (`await`).
- Dari Indonesia ke Neon, setiap query butuh puluhan sampai ratusan ms dan menahan koneksi.
- **Fix:** Cache di memori dengan key hash API key (`{keyId, userId, expiresAt, suspended}`), TTL 30–60 detik, dan batas ukuran.
- **Fix:** `lastUsedAt` ditulis sekali per 60 detik per key tanpa `await`.
- **Tradeoff:** Key yang di-revoke atau user yang di-suspend masih lolos sampai TTL habis; hapus entri cache di handler revoke/suspend.
- **Hasil:** Dari 3 query per request menjadi sekitar 0 (peningkatan latency terbesar).

#### Komentar

- **Setuju — ini bottleneck middleware terbesar.** Di `apps/api/src/middleware/auth.ts:63-95`, ketiga query memang berjalan sekuensial dengan `await` di setiap request inference maupun `/v1/models`.
- **Optimisasi tambahan pada cache miss:** Query 1 (`api_keys`) dan Query 2 (`users.suspended`) sebaiknya digabung menjadi satu query `INNER JOIN`, sehingga saat *cache miss* sekalipun hanya butuh 1 RTT, bukan 2 RTT.
- **Detail implementasi invalidasi yang perlu diperhatikan:** Cache di-key berdasarkan `keyHash` (SHA-256), sedangkan handler revoke key atau suspend user biasanya beroperasi dengan `keyId` atau `userId`, bukan raw API key. Oleh karena itu, mekanisme invalidasi perlu mendukung penghapusan berdasarkan `keyId` dan `userId` (misalnya dengan helper iterasi map yang ukurannya dibatasi, atau secondary index ringan).
- **Waspada cache thrashing:** Jangan menyimpan sembarang invalid API key hash ke dalam cache tanpa batas, karena serangan brute-force key acak bisa menggusur key valid dari cache. Gunakan bounded map/LRU (misalnya max 1.000–2.000 entri) khusus untuk key valid.
- **Konteks komentar `auth.ts:91`:** Komentar asli berbunyi `blocking to ensure connection is released before next` untuk mencegah penumpukan koneksi paralel. Mengubahnya menjadi debounced fire-and-forget per 60 detik aman dilakukan selama map timestamp debounce-nya juga dibatasi ukurannya dan `.catch(() => {})` tetap dipertahankan agar tidak memicu *unhandled rejection*.

#### Verifikasi ulang (Claude)

| Komentar Gemini | Hasil cek | Keputusan |
|---|---|---|
| 3 query sekuensial juga jalan di `/v1/models` | **Benar.** `routes/v1.ts:30` memasang `apiKeyAuth()` di `/models/*`. Query ada di `auth.ts:62-71` (`api_keys`), `:81-85` (`users`), `:91-94` (`UPDATE`). | Tetap. |
| Gabung query 1 dan 2 jadi `INNER JOIN` | **Benar.** Cache miss turun dari 2 RTT ke 1 RTT. | Diterima. |
| Invalidasi harus bisa by `keyId`/`userId` | **Benar, tapi belum cukup.** Sebagian besar penulis status ada di proses lain, yaitu `apps/web`: suspend user (`apps/web/src/lib/admin-actions.ts:61`), revoke key dari abuse case (`admin-actions.ts:1228`), hapus akun (`apps/web/src/lib/account-deletion.ts:14-27`), dan hapus key fallback (`apps/web/src/lib/actions.ts:428`). Cache di memori proses API tidak bisa dihapus dari proses web. Di proses API sendiri hanya ada `handlers/keys.ts:232` (rotate, `expiresAt` dipendekkan) dan `:266` (delete key). | **Koreksi.** Batas staleness adalah TTL, bukan invalidasi. TTL cukup **30 detik**. Invalidasi lokal by `keyId` cukup di `keys.ts:232` dan `:266`. Kalau revoke/suspend harus langsung berlaku, web perlu memanggil endpoint internal API atau menaikkan versi lewat Redis. Itu di luar scope tahap ini. |
| Bahaya cache thrashing dari brute-force key acak | **Benar sebagai aturan desain.** Cukup cache key yang valid saja, tanpa negative cache. Dengan aturan itu key acak tidak pernah masuk map, jadi tidak bisa menggusur key valid. `ipRateLimit` sudah jalan sebelum `apiKeyAuth` (`routes/v1.ts:30-31`), jadi brute-force tetap dibatasi per IP. | Diterima. Batas map 2.000 entri, hapus entri tertua (`Map` urutan insert). |
| Map debounce `lastUsedAt` juga harus dibatasi | **Benar, tapi tidak perlu map kedua.** Simpan `lastTouchedAt` di entri cache yang sama. Batas ukurannya ikut batas cache. | Disederhanakan: satu map. |
| Komentar `auth.ts:91` soal "blocking" | **Konteks git:** commit `98adb7b` mengubah fire-and-forget menjadi `await`. Dengan Neon HTTP tidak ada koneksi yang ditahan. Risiko yang tersisa: tulisan yang tertunda menumpuk saat Neon lambat. Debounce 60 detik per key membatasi itu menjadi maksimal 1 tulisan per key per menit. | Diterima, `.catch(() => {})` dipertahankan. |

**Catatan rotate key:** `keys.ts:232` memendekkan `expiresAt` key lama sampai akhir grace period. Kalau `expiresAt` disimpan di cache, key lama bisa hidup sampai 30 detik setelah grace habis. Invalidasi lokal by `keyId` di titik itu menutup celah ini.

---

### 2. Body 10 MB per request membebani RAM

**Pernyataan Claude** (`apps/api/src/handlers/v1.ts:16`, `apps/api/src/domain/router.ts` `dispatchRequest`):
- Satu body tersimpan sekitar 3–4 kali di heap: string mentah, object hasil `c.req.json()`, salinan `{...body}`, lalu `JSON.stringify(payload)`.
- Satu request 10 MB bisa makan sekitar 40 MB heap. Batas concurrency 5 berlaku per key, jadi banyak key bersamaan bisa menghabiskan 2 GB.
- **Fix:** Buat `MAX_BODY_BYTES` bisa diatur lewat env, default 2–4 MB (kecuali butuh gambar base64 besar).
- **Fix:** Samakan `client_max_body_size` di Nginx.
- **Fix:** Tambahkan batas concurrency global untuk semua key, misalnya 20–30 slot.

#### Komentar

- **Diagnosis risiko OOM sangat tepat, dengan sedikit koreksi mekanik:** Di `apps/api/src/domain/router.ts:754`, `{ ...body }` adalah *shallow copy* (array `messages` tetap memakai referensi yang sama), bukan deep clone. Namun, estimasi puncak 30–50 MB per request 10 MB tetap realistis karena kombinasi: buffer mentah di `bodyLimit`, object graph V8 dari `c.req.json()` (sering 2–3x ukuran JSON mentah), validasi Zod `safeParse` (dengan `MAX_MESSAGES` default 2.000), dan string hasil `JSON.stringify(payload)`.
- **Global concurrency cap adalah proteksi OOM paling penting:** Untuk RAM 2 GB, membatasi total request in-flight global (misalnya 20–30 slot) jauh lebih menentukan stabilitas memori daripada sekadar menurunkan limit body, terutama karena streaming SSE menahan koneksi dan buffer dalam durasi lama.
- **Catatan konsistensi saat mengubah `MAX_BODY_BYTES`:**
  - `apps/api/src/handlers/v1.ts:16` menandai `10 * 1024 * 1024` sebagai `PRD §14.1` — pastikan perubahan default 2–4 MB tidak melanggar kebutuhan klien vision/base64 yang ada.
  - Pesan error 413 di `apps/api/src/routes/v1.ts:20` dan `apps/api/src/app.ts:124` masih meng-hardcode teks `'10MB'`. Jika `MAX_BODY_BYTES` dibuat configurable via env, label error dan route Anthropic juga harus ikut diselaraskan.

#### Verifikasi ulang (Claude)

| Komentar Gemini | Hasil cek | Keputusan |
|---|---|---|
| `{ ...body }` hanya shallow copy | **Benar.** `router.ts:754` hanya menyalin properti tingkat atas. Klaim awal Claude ("salinan body") tidak tepat. | Koreksi diterima. |
| `bodyLimit` menyimpan buffer mentah | **Sebagian salah.** Di `hono@4.13.16` (`middleware/body-limit/index.js`), kalau header `Content-Length` ada, `bodyLimit` hanya membaca header lalu lanjut tanpa buffer. Buffer chunk hanya terjadi untuk request `Transfer-Encoding: chunked`. | Koreksi: buffer hanya untuk chunked. |
| Validasi Zod dengan `MAX_MESSAGES` default 2.000 | **Salah untuk `/v1/chat/completions`.** `MAX_MESSAGES` hanya ada di `routes/anthropic.ts:45`. Schema v1 (`packages/shared/src/types.ts:32`) memakai `z.array(chatMessageSchema).min(1)` tanpa batas atas. Zod membuat object baru, tapi string besar (misalnya base64) dipakai bersama lewat referensi, tidak disalin. | Koreksi. |
| Puncak 30–50 MB per request 10 MB realistis | **Masuk akal, dengan sebab yang berbeda.** Temuan yang terverifikasi: `c.req.json()` menyimpan **teks mentah** di `bodyCache["text"]` milik `HonoRequest` (`hono/dist/request.js:81-105`). Teks itu tetap hidup selama context request hidup, termasuk sepanjang stream SSE. Jadi selama streaming yang tertahan adalah teks mentah, object hasil parse (`rawBody`), dan output Zod. Saat dispatch ditambah string `JSON.stringify(payload)`. | Diterima. Ini alasan kuat untuk global concurrency cap. |
| Global concurrency cap paling penting | **Setuju.** Tidak ada batas global saat ini. `gatewayGuards` hanya membatasi 5 slot per key (`routes/v1.ts:30-31`). | Diterima, 20–30 slot via env. Cap ini perlu juga di route Anthropic dan `/v1/responses`. |
| Label `'10MB'` hardcoded dan route Anthropic perlu diselaraskan | **Benar, dengan tambahan penting.** Route Anthropic **sudah** configurable (`ANTHROPIC_MAX_BODY_BYTES`, `routes/anthropic.ts:41-42`), tapi defaultnya **32 MiB** (`33_554_432`). Itu 3x lebih besar dari v1. Kalau `ANTHROPIC_ENABLED=true`, risiko OOM di route ini lebih besar. | Diterima. Di VPS 2 GB set `ANTHROPIC_MAX_BODY_BYTES` setara dengan v1. |
| `PRD §14.1` perlu dicek | **Dokumen PRD tidak ada di repo.** Hanya komentar di `handlers/v1.ts:16`. | Default kode tetap 10 MB. Turunkan lewat env di VPS 2 GB saja. Default global tidak diubah. |

---

### 3. Jumlah koneksi DB berlebihan untuk 2 GB

**Pernyataan Claude** (`packages/db/src/index.ts:476-567`):
- Pool yang ada: Neon HTTP agent `maxSockets: 32`, Neon WS Pool `max: 5`, postgres-js primary/fallback `max: 10`, dan handle sync `max: 4`.
- Kalau Postgres fallback jalan di perangkat yang sama, setiap backend memakai sekitar 5–10 MB RSS.
- **Fix:** Fallback `max` 4–5. Postgres lokal: `max_connections=20`, `shared_buffers=128MB`, `work_mem=4MB`.

#### Komentar

- **Perlu pelurusan agar tidak salah fokus:**
  - `neonAgent` (`maxSockets: 32` di `packages/db/src/index.ts:85`) adalah pool socket HTTP/TLS **outbound ke Neon**, bukan proses backend Postgres lokal. Overhead memorinya sangat kecil dan bersifat lazy. Jadi `maxSockets: 32` bukan masalah RAM utama.
  - Pool `_localDb` (`max: 10`) dan `_fallbackDb` (`max: 10`) **tidak aktif bersamaan** dengan Neon pada kondisi normal. Saat `DATABASE_URL` mengarah ke Neon dan tidak sedang failover, hanya Neon HTTP + Neon WS Pool (`max: 5`) + sync handle (`max: 4`) yang terpakai.
- **Bagian yang sangat tepat:** Menurunkan `max` di `getLocalDb()` / `getFallbackDb()` dari `10` ke `4–5` dan men-tuning Postgres lokal (`max_connections=20`, `shared_buffers=128MB`, `work_mem=4MB`) adalah langkah wajib jika Postgres fallback berjalan di perangkat RAM 2 GB yang sama. Sebaiknya tambahkan juga `maintenance_work_mem=32MB` dan `effective_cache_size=256MB` agar autovacuum tidak memicu lonjakan RSS.

#### Verifikasi ulang (Claude)

| Komentar Gemini | Hasil cek | Keputusan |
|---|---|---|
| `neonAgent maxSockets: 32` bukan masalah RAM | **Benar.** Ini socket TLS keluar ke Neon, dibuat lazy. Daftar pool di analisa awal memang campur aduk. | Koreksi diterima. |
| `_localDb`/`_fallbackDb` tidak aktif bersamaan dengan Neon | **Benar.** `getPrimaryDb()` (`packages/db/src/index.ts:533-543`) hanya memakai `getLocalDb()` kalau `DATABASE_URL` bukan Neon. `getFallbackDb()` hanya dipanggil saat `resolveActiveTarget() === 'fallback'` atau saat replay failover (`:651`, `:706`, `:713`). | Diterima. |
| Sync handle `max: 4` aktif normal | **Benar, sedikit lebih detail.** Full sync (`sync.ts:326-327`) membuka source `max: 2` dan destination `max: 4`. Kalau source Neon, `createDbHandle` memakai HTTP tanpa pool. Jadi beban ke Postgres lokal saat sync normal maksimal 4 koneksi. Targeted sync (`sync.ts:539-540`) memakai 2. | Tetap. |
| Turunkan `max` fallback ke 4–5 | **Tetap perlu.** Saat failover aktif, Postgres lokal menerima `_fallbackDb` (`max: 10`, `index.ts:521`) **ditambah** handle sync. Itu tepat saat beban paling tinggi. | Diterima. Buat `max` bisa diatur via env, default tetap 10. Di VPS set 5. |
| `effective_cache_size=256MB` mencegah lonjakan RSS autovacuum | **Salah.** `effective_cache_size` hanya petunjuk untuk query planner. Nilai ini tidak mengalokasikan memori dan tidak memengaruhi autovacuum. Yang membatasi memori autovacuum adalah `autovacuum_work_mem` (default ikut `maintenance_work_mem`, 64 MB). | Koreksi: pakai `maintenance_work_mem=32MB` dan `autovacuum_max_workers=2`. `effective_cache_size=256MB` boleh dipakai sebagai petunjuk planner, bukan untuk hemat RAM. |

**Konfigurasi Postgres lokal yang disarankan (RAM 2 GB, berbagi dengan Node):**

```conf
max_connections = 20
shared_buffers = 128MB
work_mem = 4MB
maintenance_work_mem = 32MB
autovacuum_max_workers = 2
effective_cache_size = 256MB   # planner hint only
```

---

## Prioritas Sedang

### 4. `/v1/models` dan `/v1/models/:id` query DB setiap dipanggil

**Pernyataan Claude** (`apps/api/src/handlers/v1.ts:68,114`):
- Data yang sama sudah ada di snapshot router. Pakai ulang snapshot itu.
- Dynamic `import()` per request di sana juga tidak perlu.

#### Komentar

- **Setuju penuh — quick win yang bersih.**
- **Gotcha teknis yang terlewat Claude:** `RouterModelSource` di `apps/api/src/domain/router.ts:74-89` **belum memuat kolom `displayName`**, padahal `handleListModels` dan `handleGetModel` mengembalikan `display_name: m.displayName`. Jadi sebelum memakai ulang snapshot router, `displayName: s.models.displayName` harus ditambahkan ke `RouterModelSource` dan `loadSnapshotFromDb()`.
- **Soal dynamic `import()`:** Di Node.js ESM, modul di-cache setelah import pertama sehingga tidak membaca disk ulang, tetapi tetap menyisakan overhead microtask dan membuat kode kurang konsisten. Menggantinya dengan helper statis dari `router.ts` akan langsung menghilangkan dynamic import tersebut.

---

### 5. Full sync fallback setiap 10 menit

**Pernyataan Claude** (`packages/db/src/sync.ts:176`):
- Tabel tipe upsert dibaca ulang semua barisnya dari Neon setiap kali jalan. Memori aman karena per batch, tapi CPU ARM dan egress Neon terpakai terus.
- **Fix:** Naikkan `DB_SYNC_INTERVAL_MS` ke 30–60 menit, atau beri watermark `updatedAt` juga ke tabel upsert.

#### Komentar

- **Setuju, terutama dari sisi I/O storage perangkat Android.** Selain CPU ARM dan egress Neon, melakukan full-table upsert (`ON CONFLICT DO UPDATE`) untuk belasan tabel setiap 10 menit memicu penulisan WAL, disk I/O berulang pada storage eMMC/UFS HP, serta autovacuum di Postgres lokal.
- **Rekomendasi realistis:** Menaikkan `DB_SYNC_INTERVAL_MS` ke 30–60 menit adalah solusi paling aman dan zero-risk. Menambahkan watermark `updatedAt` pada semua tabel upsert lebih kompleks karena tidak semua tabel memiliki kolom `updatedAt` dan pola watermark tidak bisa mendeteksi *hard delete*.
- **Temuan bonus (potensi bug di `packages/db/src/sync.ts:89-97`):** Pada spesifikasi tabel `payment_events`, tertulis `tsProp: 'processedAt'` dan `tsCol: s.paymentEvents.processedAt`, tetapi `tsColSql: 'created_at'`. Ini berpotensi salah kolom SQL saat membaca watermark `SELECT max("created_at")`. Layak dicek dan diperbaiki terpisah.

---

### 6. `/v1/responses` melakukan request internal kedua

**Pernyataan Claude** (`apps/api/src/app.ts:136-153`):
- `app.request()` men-stringify ulang body dan menjalankan ulang seluruh middleware `/v1/chat/completions`. Ada satu salinan body tambahan.
- Hanya berlaku kalau `RESPONSES_API_ENABLED=true`.

#### Komentar

- **Akurat dan penempatan prioritasnya tepat.**
- **Detail tambahan dari codebase:** Di `apps/api/src/app.ts:126-130`, `internalEnv` sudah mengeset `ipRateLimited: true`, sehingga `ipRateLimit` **tidak** dihitung dua kali. Namun `bodyLimit`, `apiKeyAuth`, `gatewayGuards`, serta `JSON.stringify(body)` memang tetap berjalan ulang.
- Jika `RESPONSES_API_ENABLED` tidak diaktifkan (`false`/unset), dampaknya 0 sehingga tidak perlu disentuh sekarang.

---

## Prioritas Rendah

### 7. Redis: sekitar 5–7 round-trip per request

**Pernyataan Claude**:
- Rinciannya: rate limit IP, rate limit key, acquire dan release concurrency, cek circuit per kandidat, dan `recordSuccess`.
- Lewat loopback lokal waktunya di bawah 1 ms, jadi aman. Redis harus tetap di localhost. Kalau Redis remote, gabungkan ke `multi()`/pipeline.

#### Komentar

- **Teknisnya akurat, tapi ada opsi arsitektur yang lebih hemat RAM untuk 2 GB single-node:**
  - Di `apps/api/src/ratelimit.ts:82-89`, aplikasi sudah memiliki fallback `InMemoryRateLimitStore` saat `REDIS_URL` tidak diset.
  - Karena VPS Android 2 GB hanya menjalankan **1 instance Node.js**, menjalankan daemon Redis lokal bisa dipertimbangkan untuk **dimatikan sekalian** agar menghemat ~30–50 MB RSS, menghilangkan 5–7 IPC RTT per request, dan mengurangi jumlah service yang harus dijaga dari OOM/Doze.
  - Tradeoff-nya: state rate-limit dan circuit-breaker reset saat proses restart (umumnya masih sangat bisa diterima untuk deployment single-node 2 GB).
- **Detail kecil di codebase:** Di `apps/api/src/ratelimit.ts:126-127`, `trackConcurrency()` masih memanggil `await import('./lib/redis-store')` di setiap request padahal `RedisRateLimitStore` sudah di-import secara statis di baris 1. Ini bisa langsung dibersihkan.

---

## Runtime di Android/Debian (Tanpa Ubah Kode)

**Pernyataan Claude**:
- Jalankan `node apps/api/dist/index.js` (`pnpm start`). Jangan pakai `tsx` (esbuild + watcher tambah RAM ~100 MB).
- Pakai satu instance saja, tanpa PM2 cluster.
- Set `NODE_OPTIONS=--max-old-space-size=512`.
- systemd: `MemoryMax=700M` dan `Restart=always`. Tambahkan zram atau swap 1 GB.
- Matikan `/docs` (Scalar) di prod (sudah default kalau `NODE_ENV=production`).
- Android: pakai `termux-wake-lock` dan matikan battery optimization untuk Termux.
- Kalau `REDIS_URL` diset: `maxmemory 32mb` di `DEPLOYMENT_VPS.md` sudah cukup.

### Komentar

- **Menjalankan `dist/index.js`, single instance, dan `termux-wake-lock`:** Sangat tepat dan wajib diterapkan.
- **Konflik angka `max-old-space-size=512` vs `MemoryMax=700M`:** RSS aktual Node.js (V8 heap + code space + native buffers + TLS/undici) biasanya mencapai 1,3–1,6x dari batas heap. Jika `max-old-space-size=512`, RSS bisa menyentuh 700–800 MB sebelum GC agresif selesai, sehingga systemd cgroup OOM killer bisa mematikan proses lebih dulu. Kombinasi yang lebih aman:
  - `NODE_OPTIONS=--max-old-space-size=384` dengan `MemoryMax=650M`, **atau**
  - `NODE_OPTIONS=--max-old-space-size=512` dengan `MemoryMax=850M`.
- **Catatan lingkungan Android (Termux + proot-distro vs chroot/native):** Jika Debian berjalan di dalam Termux `proot-distro`, `systemd` umumnya tidak berjalan sebagai PID 1 sehingga unit file `MemoryMax`/`Restart=always` tidak bisa dipakai; gunakan supervisor ringan (script restart loop / `supervisord` / PM2 mode `fork` tunggal dengan `--max-memory-restart`). Jika memakai chroot/native Debian di perangkat rooted, barulah systemd relevan.
- **Verifikasi `/docs`:** Benar sudah fail-closed di `apps/api/src/app.ts:152-156` selama `NODE_ENV=production` dan `ENABLE_API_DOCS` tidak `true`.
- **Penghematan tambahan yang terlewat Claude (`apps/api/src/index.ts:40-119`):** Terdapat 5 background `setInterval` job yang memakai `runLeased()` (query lease ke DB tiap 1–15 menit). Di single-node VPS 2 GB, set `JOB_LEASE_ENABLED=false` (sudah didukung langsung oleh `lib/job-lease.ts`) untuk menghilangkan query lease yang tidak perlu ke Neon.

---

## Ringkasan Evaluasi & Urutan Pengerjaan yang Disarankan

| Poin Claude | Verdict | Catatan Kunci |
|---|---|---|
| 1. Auth cache + debounce `lastUsedAt` | **Setuju (Prioritas 1)** | Gabung query 1 & 2 jadi `JOIN`; hanya cache key valid, maks 2.000 entri; TTL 30 detik adalah batas staleness karena suspend/revoke kebanyakan ditulis oleh `apps/web`; invalidasi lokal hanya di `keys.ts:232,266` |
| 2. Limit body + global concurrency | **Setuju (Prioritas 2)** | `{...body}` shallow copy; `bodyLimit` tidak buffer kalau ada `Content-Length`; teks mentah tertahan di `bodyCache` sepanjang stream; global cap paling krusial; Anthropic default 32 MiB |
| 3. DB pool & Postgres lokal | **Sebagian tepat** | `neonAgent` bukan masalah RAM; `max` fallback 10 via env, set 5 di VPS; `effective_cache_size` tidak menghemat RAM |
| 4. `/v1/models` pakai snapshot router | **Setuju (Prioritas 3)** | Tambah `displayName` ke `RouterModelSource` & `loadSnapshotFromDb()` dulu |
| 5. Interval full sync fallback | **Setuju** | Naikkan `DB_SYNC_INTERVAL_MS` ke 30–60 menit; cek bug `tsColSql` di `payment_events` |
| 6. `/v1/responses` internal request | **Setuju (Low)** | `ipRateLimit` sudah tidak double; abaikan jika `RESPONSES_API_ENABLED` tidak aktif |
| 7. Redis round-trip | **Setuju + Opsi** | Di single-node 2 GB, pertimbangkan matikan Redis sekalian (pakai `InMemoryRateLimitStore`) |
| Runtime Android/Debian | **Setuju + Koreksi** | Sesuaikan rasio `max-old-space-size` vs `MemoryMax`; set `JOB_LEASE_ENABLED=false`; cek dukungan systemd di Termux |

### Urutan Eksekusi yang Disarankan

1. **Tahap 0 (Config & Runtime, tanpa ubah kode):** Jalankan `dist/index.js`, set `NODE_ENV=production`, `NODE_OPTIONS=--max-old-space-size=384` (atau `512`), `JOB_LEASE_ENABLED=false`, naikkan `DB_SYNC_INTERVAL_MS` ke 30–60 menit, dan pertimbangkan menonaktifkan Redis jika single-node.
2. **Tahap 1 (Poin 1):** Gabungkan query auth jadi `JOIN`. Tambahkan bounded cache khusus key valid (TTL 30 detik, maks 2.000 entri) dengan `lastTouchedAt` di entri yang sama. Debounce `lastUsedAt` 60 detik. Hapus cache by `keyId` di `handlers/keys.ts:232` dan `:266`.
   - **Status: selesai (2026-11-22).** `apps/api/src/middleware/auth.ts` (`lookupKeyAuth`, `invalidateApiKeyAuthCache`), env `API_KEY_AUTH_CACHE_TTL_MS` (default `30000`, `0` = cache mati). Test: `apps/api/src/middleware/auth-cache.test.ts`. Dua test di `routes/security.test.ts` yang menulis DB langsung sekarang memanggil `invalidateApiKeyAuthCache()`. Suite API 570 test lulus. `P1-04` sempat gagal sekali karena flaky: 121 request melewati batas jendela menit rate limit.
3. **Tahap 2 (Poin 2):** Tambahkan global concurrency cap (20–30 slot, via env) untuk v1, Anthropic, dan `/v1/responses`. Buat `MAX_BODY_BYTES` configurable via env beserta label error 413-nya. Di VPS 2 GB set `ANTHROPIC_MAX_BODY_BYTES` setara v1.
   - **Status: selesai (2026-11-22).** Termasuk perbaikan bug slot concurrency per key yang dilepas sebelum stream selesai (projectmem issue #0004). Detail di bagian "Implementasi Tahap 2" di bawah.
4. **Tahap 3 (Poin 4):** Tambahkan `displayName` ke router snapshot lalu arahkan `/v1/models` & `/v1/models/:id` membaca dari snapshot.
5. **Tahap 4 (Poin 3):** Buat `max` koneksi fallback/lokal configurable via env (default 10, set 5 di VPS) dan terapkan tuning `postgresql.conf` lokal di atas.
   - **Status: kode selesai (2026-11-22).** Env `DB_POOL_MAX`. Tuning `postgresql.conf` diterapkan manual di server. Detail di bagian "Implementasi Poin 3" di bawah.

---

## Implementasi Tahap 1: Cache Auth API Key (2026-11-22)

Basis: `origin/main` di `d0dff8e` (PR #35, hanya perubahan `apps/web`, tidak bentrok).

### Dua jalur autentikasi

Cache hanya berlaku untuk jalur API key. Jalur session tidak diubah.

| Jalur | Dipakai oleh | Middleware | Cache |
|---|---|---|---|
| Session (cookie Better Auth) | Dashboard web: `/v1/keys`, `/v1/account`, dll. | `apps/api/src/middleware/session-auth.ts` | Tidak. Setiap request query `sessions JOIN users`, jadi suspend langsung memblokir dashboard. |
| API key (`Bearer mp-...` / `x-api-key`) | Aplikasi user: `/v1/chat/completions`, `/v1/models`, route Anthropic | `apps/api/src/middleware/auth.ts` (`apiKeyAuth`) | Ya, TTL 30 detik. |

### Alur `apiKeyAuth` setelah perubahan

```
Request "Bearer mp-xxxx"
  ├─ hash SHA-256 key
  ├─ entri cache ada dan umur < TTL?
  │     ├─ ya    → pakai cache (0 query)
  │     └─ tidak → 1 query: api_keys LEFT JOIN users, simpan ke cache
  │                key tidak valid → 401, tidak disimpan
  ├─ expired?   → 401 api_key_expired
  ├─ suspended? → 403 account_suspended (baris user hilang juga dianggap suspended)
  ├─ lastUsedAt terakhir ditulis ≥ 60 detik lalu?
  │     └─ ya → UPDATE di latar belakang, request tidak menunggu
  └─ next()
```

Sebelumnya: 3 query berurutan per request (select key, select user, `await` update `lastUsedAt`). Untuk 1 request per detik dari satu key: 180 query per menit sebelumnya, sekarang sekitar 4.

### Konsekuensi

- Suspend user, revoke key dari abuse case, dan hapus akun ditulis oleh `apps/web` (proses lain). Ketiganya baru berlaku di jalur API key paling lama setelah TTL (30 detik).
- Rotate (`handlers/keys.ts:234`) dan delete (`handlers/keys.ts:269`) lewat API langsung menghapus entri cache key itu, jadi efeknya instan.
- Kolom `lastUsedAt` di dashboard bisa telat sampai 60 detik.

### File yang diubah

| File | Perubahan |
|---|---|
| `apps/api/src/middleware/auth.ts` | `CachedKeyAuth`, `lookupKeyAuth()` (query JOIN + cache), `invalidateApiKeyAuthCache(keyId?)` (export), debounce `lastUsedAt` 60 detik tanpa `await`. Kapasitas 2.000 entri; kalau penuh, entri tertua dibuang. |
| `apps/api/src/handlers/keys.ts` | Panggil `invalidateApiKeyAuthCache()` setelah rotate dan delete. |
| `apps/api/src/middleware/auth-cache.test.ts` | Test baru: revoke tetap lolos dalam TTL lalu 401 setelah invalidasi; TTL `0` membuat suspend langsung 403; `lastUsedAt` hanya ditulis sekali dalam jendela 60 detik. |
| `apps/api/src/routes/security.test.ts` | Dua test yang menulis DB langsung (simulasi proses web) sekarang memanggil `invalidateApiKeyAuthCache()` sebelum request berikutnya. |
| `.env.development.example`, `.env.production.example` | Tambah `API_KEY_AUTH_CACHE_TTL_MS` (dikomentari, nilai default). |

### Env baru: `API_KEY_AUTH_CACHE_TTL_MS`

| Nilai | Efek |
|---|---|
| Tidak diset | `30000` (30 detik) |
| `0` | Cache mati. Tetap 1 query JOIN per request, bukan 3. Suspend/revoke langsung berlaku. |
| Angka positif | TTL dalam milidetik |
| Negatif / bukan angka | Jatuh ke `30000` |

Perubahan nilai berlaku setelah proses API di-restart. Kapasitas cache (2.000) dan debounce `lastUsedAt` (60 detik) hardcoded.

Rekomendasi VPS 2 GB: biarkan default. Set `0` sementara kalau suspend harus instan, misalnya saat menangani abuse.

### Verifikasi

- `pnpm --filter @morphic/api typecheck`: bersih.
- `pnpm --filter @morphic/api test` (dengan `DUITKU_PRIMARY_PAYMENT_METHOD=VC DUITKU_BACKUP_PAYMENT_METHOD=BC`): 570/570 lulus.
- Catatan flaky: `P1-04: per-key 429` di `routes/gateway.test.ts:115` sempat gagal sekali. Rate limit memakai jendela menit tetap, jadi 121 request yang melewati pergantian menit akan reset. Lulus saat dijalankan ulang. Tidak terkait perubahan ini.

---

## Implementasi Tahap 2: Batas Concurrency dan Body (2026-11-22)

### Bug yang ditemukan: slot concurrency per key dilepas sebelum stream selesai

Ditemukan saat menelusuri flow tahap 2. Bug ini sudah ada sebelum tahap 1 dan tercatat di projectmem sebagai issue #0004.

- `gatewayGuards` (`apps/api/src/middleware/auth.ts`) melepas slot di blok `finally` setelah `await next()`.
- `streamSSE` (`hono/dist/helper/streaming/sse.js:53-54`) menjalankan callback stream tanpa `await`, lalu langsung mengembalikan `Response`.
- Akibatnya `next()` selesai begitu header stream terkirim, dan slot langsung dilepas walaupun token masih mengalir 10–120 detik lagi.
- Batas "5 concurrent per key" hanya berlaku di fase sebelum stream, sekitar 1–3 detik.

**Dampak.** Batas yang masih berlaku hanya 120 request/menit per key, sementara satu stream bisa hidup sampai 2 menit (`UPSTREAM_TIMEOUT_MS=120000`). Jadi satu key bisa menahan sekitar 240 stream bersamaan, bukan 5. Request tetap memotong kredit (`reserve`), jadi tidak gratis. Risikonya:

1. RAM VPS 2 GB habis, karena setiap stream menahan body request di memori. Semua user ikut kena.
2. Kuota atau rate limit provider upstream habis, sehingga user lain ikut gagal.
3. Lebih parah lagi kalau satu user memakai beberapa key.

Bug ini juga bisa terpicu tanpa niat jahat, misalnya dari aplikasi user dengan bug retry atau batch job paralel.

**Bukti.** Test `per-key slot stays held for the whole stream` di `apps/api/src/middleware/concurrency.test.ts` gagal di kode lama (`200 !== 429`) dan lulus setelah perbaikan.

### Flow as-is dan to-be (request streaming `/v1/chat/completions`)

**As-is:**

```
1. bodyLimit        Content-Length > 10 MB (hardcoded)? → 413 "10MB" (hardcoded)
2. ipRateLimit      300/menit per IP
3. apiKeyAuth       cek key (cache tahap 1)
4. gatewayGuards    120/menit per key, ambil slot per key (maks 5)
5. handler          c.req.json(), Zod, reserve, fetch provider, return streamSSE(...)
   gatewayGuards    finally: slot dilepas            ← terlalu cepat
6. streaming        10–120 detik, body masih di RAM, tanpa batas jumlah stream
```

**To-be:**

```
1. bodyLimit        batas dari GATEWAY_MAX_BODY_BYTES (default 10 MB), label 413 mengikuti nilai
2. ipRateLimit      sama
3. apiKeyAuth       sama
4. gatewayGuards    120/menit per key, ambil slot per key (maks 5)
                    ambil slot global (GATEWAY_GLOBAL_CONCURRENCY, jika > 0)
                    penuh → 503 server_overloaded + Retry-After: 1 (slot per key dikembalikan)
5. handler          sama
6. streaming        sama
   selesai / client putus / upstream error → slot per key dan global dilepas
```

### Perbandingan

| Aspek | As-is | To-be |
|---|---|---|
| Batas body v1 dan `/v1/responses` | 10 MB hardcoded | `GATEWAY_MAX_BODY_BYTES`, default tetap 10 MB |
| Label pesan 413 | `"10MB"` dan `"32MB"` hardcoded | Dihitung dari nilai batas (`formatBodyLimit`) |
| Batas body Anthropic | `ANTHROPIC_MAX_BODY_BYTES`, default 32 MiB | Sama. Hanya labelnya yang sekarang mengikuti nilai. |
| Slot per key (5) | Dilepas saat header stream terkirim | Dilepas saat stream selesai, client cancel, atau error |
| Batas global per proses | Tidak ada | `GATEWAY_GLOBAL_CONCURRENCY`, default `0` (mati) |
| Saat batas global penuh | Tidak ada pengecekan | `503`, kode `server_overloaded` (Anthropic: `overloaded_error`), `Retry-After: 1` |
| `/v1/responses` | Melewati chain v1 lewat request internal | Sama. Hanya chain dalam yang mengambil slot, jadi tidak dihitung dua kali. |

### Keputusan desain

- **Pelepasan slot mengikuti umur response.** Middleware `releaseWhenResponseDone` membungkus body response `text/event-stream`. Slot dilepas sekali saja: saat stream selesai dibaca, saat client cancel, atau saat stream error. Response non-stream (JSON) dilepas langsung, karena handler sudah selesai bekerja. `@hono/node-server` memanggil `reader.cancel()` saat socket client tertutup (`dist/utils.mjs:6-11`), jadi client yang putus juga melepas slot.
- **Batas global di memori proses, bukan Redis.** Yang dilindungi adalah RAM node itu sendiri. Dengan multi-node, setiap node punya batas sendiri.
- **Map sinkron untuk slot global.** Cek dan tambah slot terjadi tanpa `await`, jadi dua request tidak bisa sama-sama lolos di slot terakhir. Slot juga punya TTL pengaman yang sama dengan slot per key (`concurrencySlotTtlSeconds`), supaya slot yang gagal dilepas tidak mengurangi kapasitas selamanya.
- **503, bukan 429.** Ini kondisi server, bukan kesalahan user. OpenAI SDK otomatis retry untuk 503.
- **Default batas global mati.** Deployment lain tidak berubah perilakunya. Nilai diset di VPS.
- **Default body tetap 10 MB** (`PRD §14.1`, dokumen PRD tidak ada di repo). Nilai diturunkan lewat env di VPS saja.

### Perubahan perilaku untuk user

User yang benar-benar menjalankan lebih dari 5 stream bersamaan per key sekarang mendapat `429 concurrency_limit_exceeded`. Sebelumnya mereka lolos karena bug.

### Env baru

| Env | Default | Rekomendasi VPS 2 GB | Keterangan |
|---|---|---|---|
| `GATEWAY_MAX_BODY_BYTES` | `10485760` (10 MB) | `4194304` (4 MB) | `/v1/chat/completions` dan `/v1/responses`. Nilai tidak valid jatuh ke default. |
| `GATEWAY_GLOBAL_CONCURRENCY` | `0` (mati) | `25` | Maksimum request gateway in-flight per proses API. |
| `ANTHROPIC_MAX_BODY_BYTES` (sudah ada) | `33554432` (32 MB) | `4194304` (4 MB) | Samakan dengan v1. Hanya relevan jika `ANTHROPIC_ENABLED=true`. |

Ketiganya dibaca saat start (body) atau per request (global), tapi `process.env` tidak berubah selama proses jalan. Perubahan nilai berlaku setelah API di-restart.

**Estimasi RAM terburuk** dengan body 4 MB (sekitar 12 MB tertahan per request: teks mentah di cache body Hono, object hasil parse, output Zod): 25 slot sekitar 300 MB, masih muat di heap 384–512 MB. 50 slot sekitar 600 MB, terlalu besar.

### File yang diubah

| File | Perubahan |
|---|---|
| `apps/api/src/middleware/auth.ts` | `gatewayGuards`: slot global, `serverOverloaded()`, `releaseWhenResponseDone()`, `acquireGlobalSlot()`, `resolveGlobalConcurrency()`. |
| `apps/api/src/middleware/body-limit.ts` | `formatBodyLimit()` untuk label 413. |
| `apps/api/src/handlers/v1.ts` | `MAX_BODY_BYTES` dari `GATEWAY_MAX_BODY_BYTES`, default 10 MB. |
| `apps/api/src/routes/v1.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/anthropic.ts` | Label 413 dihitung dari batas. |
| `apps/api/src/middleware/concurrency.test.ts` | Test baru: slot per key ditahan sepanjang stream; slot dilepas saat client cancel; response non-stream langsung lepas; batas global memberi 503 lintas key lalu bebas saat stream selesai. |
| `.env.development.example`, `.env.production.example` | Tambah `GATEWAY_MAX_BODY_BYTES`, `GATEWAY_GLOBAL_CONCURRENCY`. Contoh production juga memuat `ANTHROPIC_MAX_BODY_BYTES` dengan nilai rekomendasi VPS. |

### Verifikasi

- `pnpm --filter @morphic/api typecheck`: bersih. ESLint pada file yang diubah: bersih.
- Test baru di kode lama: 2 test slot per key gagal (`200 !== 429`). Di kode baru: 4/4 lulus.
- `pnpm --filter @morphic/api test` (dengan `DUITKU_PRIMARY_PAYMENT_METHOD=VC DUITKU_BACKUP_PAYMENT_METHOD=BC`): 574/574 lulus.

### Belum dikerjakan

- Slot TTL Redis (`concurrencySlotTtlSeconds`) dihitung dari `UPSTREAM_TOTAL_TIMEOUT_MS` / `UPSTREAM_TIMEOUT_MS`. Route Anthropic punya timeout sendiri (`ANTHROPIC_TOTAL_TIMEOUT_MS`, default 180 detik). Stream Anthropic yang lebih lama dari TTL slot bisa kehilangan slot-nya lebih awal. Dampaknya kecil, tapi layak dicek terpisah.
- `/v1/responses` mem-parse body di request luar sebelum slot diambil di request dalam. Hanya relevan jika `RESPONSES_API_ENABLED=true`.

---

## Pembersihan Dead Code `apps/api` (2026-11-22)

Gemini melaporkan banyak yang tidak terpakai di `apps/api`. Setiap klaim dicek ulang ke repo sebelum ada yang dihapus.

### Hasil cek klaim Gemini

| Klaim | Hasil cek | Tindakan |
|---|---|---|
| 0 file mati di `src/`, semua route ter-mount | Benar. Semua route di-mount di `app.ts`. | Tidak ada |
| `openapi.yaml` | Tidak dirujuk di mana pun. Spec yang dipakai di-generate dari Zod (`src/openapi/registry.ts`, `/openapi.json`, OpenAPI 3.1). File YAML ini 3.0.3 dengan server `api.morphic.example.com`. | **Dihapus** |
| Script `seed:dahl` rusak | Benar. `apps/api/package.json` menunjuk `scripts/seed-dahl.ts` yang tidak ada. Alias root `db:seed:dahl` memanggilnya, jadi ikut rusak. | **Keduanya dihapus** |
| 7 fungsi export mati | 6 yang benar-benar mati (tidak dipanggil di mana pun, termasuk di file sendiri). | **Dihapus** |
| `dist/`, `.turbo/` | Hasil build, sudah di-gitignore (`.gitignore:12,16`), tidak ada di repo. | Tidak ada (salah hitung) |
| `audit-folder/` (5 file) | Arsip audit lama, tidak dipakai kode. | Belum disentuh. Usulan: pindah ke `docs/archive/` |
| 4 `.md` historis | Ada 5. `AGENTS.md` dan `plan-pooling-providers.md` masih dirujuk (`docs/COMPAT_NOTES.md`, test). `API_DOCUMENTATION.md`, `AUDIT_BACKEND.md`, `OUT_OF_SCOPE_FINDINGS.md` tidak dirujuk kode. | Belum disentuh. Usulan: pindah 3 yang tidak dirujuk ke `docs/archive/` |

### Fungsi yang dihapus

| Fungsi | Lokasi |
|---|---|
| `getLastParitySnapshot` | `apps/api/src/lib/db-failover-monitor.ts` |
| `getDbSyncStatus` | `apps/api/src/lib/db-sync-log.ts` |
| `flushTargetedSyncQueue` | `apps/api/src/lib/db-sync-queue.ts` |
| `_resetWarnedLoopback` | `apps/api/src/lib/ip.ts` |
| `streamThenDestroy`, `openThenDestroy` | `apps/api/src/test-helpers/mock-upstream.ts` |

State yang dipakai fungsi-fungsi itu (`lastParitySnapshot`, `DbSyncStatus`, `warnedLoopback`, `delay`) tetap ada karena masih dipakai kode lain.

### Yang sengaja tidak dihapus

- Sekitar 70 export yang hanya dipakai di file sendiri (definisi route OpenAPI, helper converter). Kodenya terpakai, hanya kata `export`-nya yang tidak perlu.
- Seam test (`...ForTests`, `reset...`) yang dipakai test.
- `handleWebhookMock`: dipakai route `/webhooks/mock`, dan mengembalikan 404 di luar dev/test.
- `scripts/test-local.sh` dan `scripts/quickstart/`: masih dipakai.

### Verifikasi

- Tidak ada rujukan tersisa ke `openapi.yaml`, `seed:dahl`, atau fungsi yang dihapus di kode maupun docs.
- Typecheck dan ESLint bersih, `pnpm --filter @morphic/api build` sukses.
- `pnpm --filter @morphic/api test` (dengan `DUITKU_PRIMARY_PAYMENT_METHOD=VC DUITKU_BACKUP_PAYMENT_METHOD=BC`): 574/574 lulus.

---

## Implementasi Poin 3: Pool Koneksi Postgres Lokal (2026-11-22)

### Konteks

API memakai Neon sebagai database utama (`DATABASE_URL`) dan Postgres lokal di perangkat yang sama sebagai cadangan (`DATABASE_URL_FALLBACK=...@127.0.0.1:5432`). Setiap koneksi ke Postgres lokal adalah satu proses backend, sekitar 5–10 MB RSS, ditambah `work_mem` per operasi sort/hash.

### As-is dan to-be

| Kondisi | As-is | To-be |
|---|---|---|
| Normal (Neon jalan) | Postgres lokal hanya dipakai sync periodik: maksimal 4 koneksi (`packages/db/src/sync.ts:327`), lalu ditutup | Sama |
| Failover (Neon down) | Pool `getFallbackDb()` sampai 10 koneksi, hardcoded | `DB_POOL_MAX`, default 10, di VPS 5 |
| `DATABASE_URL` bukan Neon | Pool `getLocalDb()` sampai 10 koneksi, hardcoded | `DB_POOL_MAX` |
| Pool Neon WebSocket (transaksi) | `max: 5` | Tidak diubah. Koneksinya keluar ke cloud, bukan backend Postgres lokal. |
| `neonAgent` (`maxSockets: 32`) | Socket HTTP keluar ke Neon | Tidak diubah. Bukan masalah RAM. |

Dengan `DB_POOL_MAX=5`, koneksi API ke Postgres lokal saat failover turun dari maksimal 10 ke 5. Hematnya sekitar 25–50 MB RSS di Postgres.

**Tradeoff:** saat failover, request bisa sedikit antre menunggu koneksi. Batas `GATEWAY_GLOBAL_CONCURRENCY` (tahap 2) menjaga antrean tetap pendek.

**Dampak:** lebih kecil dari tahap 1 dan 2, dan hanya terasa saat failover.

### Env baru: `DB_POOL_MAX`

| Nilai | Efek |
|---|---|
| Tidak diset | `10` (sama seperti sebelumnya) |
| Angka positif | Maksimal koneksi per pool postgres-js |
| `0`, negatif, bukan angka | Jatuh ke `10` |

Rekomendasi VPS 2 GB: `DB_POOL_MAX=5`. Nilai dibaca saat pool pertama kali dibuat, jadi perubahan berlaku setelah API di-restart.

### Tuning Postgres lokal (manual, bukan kode)

Terapkan di `postgresql.conf` Postgres lokal (Termux biasanya `$PREFIX/var/lib/postgresql/postgresql.conf`), lalu restart Postgres. Nilai dan koreksinya ada di bagian verifikasi Poin 3 di atas.

```conf
max_connections = 20
shared_buffers = 128MB
work_mem = 4MB
maintenance_work_mem = 32MB
autovacuum_max_workers = 2
effective_cache_size = 256MB   # planner hint only, does not save RAM
```

`max_connections = 20` cukup untuk API (`DB_POOL_MAX=5`) ditambah sync (maksimal 4) ditambah koneksi admin atau `psql`. Kalau `apps/web` juga berjalan di perangkat yang sama dan memakai Postgres lokal, hitung pool-nya juga.

### File yang diubah

| File | Perubahan |
|---|---|
| `packages/db/src/index.ts` | `postgresPoolMax()` membaca `DB_POOL_MAX`. Dipakai di `getLocalDb()` dan `getFallbackDb()`. |
| `.env.development.example`, `.env.production.example` | Tambah `DB_POOL_MAX` (dikomentari; production dengan nilai rekomendasi VPS `5`). |

### Verifikasi

- Typecheck `@morphic/db` dan `@morphic/api`: bersih.
- Uji langsung ke Postgres lokal, 3 query `pg_sleep(0.3)` paralel: `DB_POOL_MAX=1` selesai dalam 963 ms (antre), `DB_POOL_MAX=3` dalam 349 ms (paralel). Env terbukti membatasi pool.
- `pnpm --filter @morphic/api test` (dengan `DUITKU_PRIMARY_PAYMENT_METHOD=VC DUITKU_BACKUP_PAYMENT_METHOD=BC`): 574/574 lulus.
