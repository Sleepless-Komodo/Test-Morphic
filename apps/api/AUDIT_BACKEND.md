# Backend Payment-Integrity Audit — Morphic Gateway (`apps/api`)

Audit scope: payment/credit integrity of `apps/api` against commit `6fc248c` + working tree.
Threat model: self-hosted VPS, no CDN/Cloudflare assumed, single API instance.

**Revision 3.** Rev 2 + koreksi dari review lanjutan. Dokumen ini ditulis sebagai **spesifikasi
implementasi untuk AI coding agent**. Perubahan dari rev 2 ditandai **[REV3]**.

---

## 0. Instruksi untuk agent yang mengimplementasikan

1. **Verifikasi setiap klaim terhadap source sebelum mengubah apa pun.** Nomor baris di bawah berasal dari
   audit sebelumnya dan bisa bergeser. Bila sebuah klaim tidak cocok dengan kode, hentikan dan laporkan, jangan
   memaksakan perubahan.
2. Kerjakan **satu task (T1…T10 di §3) per commit**, urut. Setelah tiap task jalankan `tsc --noEmit` dan test
   yang ada (`security.test.ts` dst.).
3. **Jangan mengerjakan** item di §7 ("Sudah termitigasi / jangan diimplementasikan").
4. Bentuk payload webhook PayPal untuk `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`,
   `CUSTOMER.DISPUTE.CREATED/RESOLVED` **belum diverifikasi** terhadap akun ini. Ekstraksi ID harus defensif dan
   diverifikasi dengan payload sandbox nyata (§9). Jangan mengarang field.
5. `sendOpsAlert()` (`lib/alert.ts`) sudah ada. Baca signature aslinya; buat satu helper `opsAlert()` yang
   membungkusnya, tidak pernah melempar error, dan dipakai semua kode baru.
6. Semua perubahan status payment harus **UPDATE kondisional** (`WHERE status IN (...) RETURNING`), tidak boleh
   read-then-write.
7. Jangan ubah perilaku `processPaymentSuccess` sama sekali (audit ini tidak memintanya).
8. **Baca §0A sebelum menulis satu baris pun. §0A mengikat: diff yang keluar dari scope ditolak.**

---

## 0A. BATAS SCOPE (mengikat, tanpa pengecualian)

Tugasmu **hanya** mengimplementasikan T1–T10 di §3 persis seperti yang tertulis. Segala hal lain di repo
**di luar scope**, termasuk bila menurutmu jelek, tidak efisien, atau salah.

### A. Allowlist file per task (hanya file ini yang boleh diubah/dibuat)

| Task | File yang boleh diubah/dibuat |
|---|---|
| T1 | `apps/api/src/lib/paypal.ts`, `apps/api/src/index.ts` (hanya `assertProductionConfig`) |
| T2 | `packages/db/src/schema.ts` (hanya tabel `payments` + 1 index di `creditLedger`), 1 file migrasi baru |
| T3 | `lib/paypal-post-payment.ts` (baru), `lib/payment-state.ts` (baru), `routes/webhooks.ts` (hanya route PayPal) |
| T4 | `lib/paypal-reconcile.ts`, `index.ts` (hanya blok interval reconcile) |
| T5 | `routes/webhooks.ts` (hanya route PayPal), `lib/paypal.ts`, `lib/payment-events.ts` (hanya tambah `recordUnmatchedEvent` + koreksi komentar), `app.ts` (hanya rate limit `/webhooks/*`) |
| T6 | `lib/paypal.ts` (`captureOrder` + classifier error), `routes/payments.ts` (hanya route capture), `lib/payment-state.ts` |
| T7 | `lib/paypal.ts` (`createOrder`, helper uang), `routes/payments.ts` (hanya route create) |
| T8 | file yang sudah disentuh T3/T4/T5 saja |
| T9 | tidak ada kode |
| T10 | tidak ada kode (hanya menjalankan skenario) |

Berkas test **baru** (`*.test.ts` di samping kode yang diubah) selalu boleh dibuat.

### B. Read-only (boleh dibaca, DILARANG diubah)

`packages/db/src/billing.ts` (`processPaymentSuccess`, `markPaymentIfOpen`, `grantCredits`, `reserve`/`pickSource`),
`lib/notify.ts`, `lib/duitku.ts` (dalam gate rilis), `lib/alert.ts`, `lib/account-deletion.ts`,
`middleware/*` (termasuk `session-auth.ts`, `auth.ts`), `ratelimit*`, seluruh kode auth/Better Auth, seluruh `web/*`,
semua tabel/skema selain yang disebut di T2, semua file konfigurasi build/lint/CI.

Bila kamu merasa **perlu** mengubah file read-only agar task jalan → **BERHENTI** dan laporkan (lihat §D). Jangan improvisasi.

### C. Larangan eksplisit

- Dilarang refactor, rename, memindahkan, memformat ulang, atau "merapikan" kode yang tidak disebut audit.
  Jangan jalankan formatter/linter-fix pada file; ikuti gaya yang sudah ada pada baris yang kamu sentuh.
- Dilarang menambah/menghapus/meng-upgrade dependency (`package.json`, lockfile) dan mengubah nama atau arti env var yang sudah ada.
- Dilarang mengubah signature/export yang dipakai file lain, **kecuali** menambah parameter opsional yang disebut di audit.
  `reconcilePaypalPayments` wajib tetap terekspor sebagai alias.
- Dilarang menghapus, menonaktifkan (`skip`/`only`), atau melemahkan test yang ada. Test lama hanya boleh diubah bila perilakunya
  sengaja berubah menurut audit, dan **sebutkan test mana + alasannya** di pesan commit.
- Dilarang menambah fitur di luar gate: **tidak ada** clawback ledger otomatis, revoke entitlement, auto-unfreeze, refactor Duitku,
  verifikasi webhook offline, outbox/queue, dsb. (semuanya di §4 = nanti, bukan sekarang).
- Dilarang menyentuh item di §7 ("jangan diimplementasikan") dan bagian "Terkonfirmasi benar" di §1.
- Dilarang menjalankan perintah destruktif: `DROP`/`TRUNCATE`/`DELETE` tanpa `WHERE` pada DB, `git push`, `git reset --hard`,
  `git push --force`, menghapus branch, mengubah `.env*`, atau memasukkan secret ke repo/log.
- Dilarang mengubah perilaku di luar yang disebut task, walau "sekalian". Contoh: jangan ikut memperbaiki Duitku, rate limit
  route lain, atau error handling di route yang tidak disebut.

### D. Aturan berhenti-dan-lapor

1. Bila klaim audit tidak cocok dengan source, atau sebuah task butuh file di luar allowlist, atau ada dua tafsir yang masuk akal:
   **hentikan task itu**, tulis temuanmu, dan lanjut ke task berikutnya yang tidak terblokir. Jangan menebak. Jika harus memilih
   untuk tetap maju, ambil tafsir **paling sempit dan paling konservatif** dan catat asumsinya.
2. Bug/masalah lain yang kamu temukan di luar scope **jangan diperbaiki**. Catat di `OUT_OF_SCOPE_FINDINGS.md`
   (file, baris, deskripsi singkat) dan biarkan.

### E. Checklist wajib di akhir SETIAP task (tempel hasilnya di pesan commit)

1. `git diff --stat` → setiap file yang muncul harus ada di allowlist §A untuk task itu. Ada file asing → batalkan perubahan di file itu.
2. `git diff` tidak berisi perubahan whitespace/format/rename murni di luar baris yang memang harus berubah.
3. `tsc --noEmit` lulus dan seluruh test yang ada tetap lulus (tidak ada test yang di-skip/dihapus).
4. Tidak ada perubahan di `package.json`/lockfile/`.env*`.
5. Satu commit = satu task; pesan commit diawali `T<n>:` dan memuat daftar file serta asumsi (bila ada).

Pelanggaran terhadap §0A (diff keluar scope, file read-only berubah, test dilemahkan) membuat hasil task dianggap **gagal**
dan harus di-revert, walaupun fungsinya benar.

---

## 1. Verdict

Arsitektur dan niat keamanan solid. **Belum siap production** sampai release gate §3 terpenuhi dan sandbox
end-to-end §9 lulus. Risiko terbesar: refund/dispute tidak ditangani (H5) dan tidak ada guard environment PayPal (H1).

### Terkonfirmasi benar (jangan disentuh)

- `interpretOrder` menurunkan status dari status **capture**, bukan order. Order `COMPLETED` tanpa data capture
  **tidak** dianggap paid (`lib/paypal.ts:135-137`).
- `verifyWebhookSignature` fail-closed (`lib/paypal.ts:338-341, 357-359, 381-387`).
- `PayPal-Request-Id` dikirim di `createOrder` (`lib/paypal.ts:199`).
- Unique index parsial `ledger_purchase_reference_unique` (`schema.ts:246`) = pengaman terakhir kredit ganda.
- `payment_events` punya unique `(provider, event_id)` (`schema.ts:381`).
- Relasi finansial memakai `onDelete: 'restrict'` (`schema.ts:355`).
- `processPaymentSuccess` atomik (`billing.ts:438-447`); `markPaymentIfOpen` kondisional (`billing.ts:406-424`).
- Callback Duitku memverifikasi ulang nominal terhadap DB **dan** API status Duitku sebelum kredit.
- Saldo ≤ 0 sudah ditolak (`pickSource` butuh `bal.credits >= estimatedCredits`) → clawback punya efek.
- Body-size cap 1 MB sudah aktif di semua route termasuk `/webhooks/*` (`app.ts:59-71`).

---

## 2. Koreksi rev 3 terhadap rev 2 (baca dulu)

Empat hal di rev 2 §6 salah/belum konsisten. Implementasi harus mengikuti versi rev 3.

1. **[REV3] `markPaymentIfOpen` tidak bisa dipakai untuk refund/dispute.** Fungsi itu hanya mengubah status
   open dan tidak pernah menimpa `paid`, padahal refund/dispute terjadi pada payment yang sudah `paid`. Handler
   H5 harus memakai fungsi baru dengan transisi eksplisit (lihat T3).
2. **[REV3] `captureId` masuk release gate, bukan "week one".** Event dispute mengidentifikasi transaksi lewat
   capture ID; tanpa kolom ini payment tidak bisa dipetakan (T2).
3. **[REV3] Jangan freeze akun pada `PAYMENT.CAPTURE.REFUNDED`.** Event itu juga terkirim saat operator sendiri
   me-refund; auto-suspend akan mengunci customer yang baru di-refund. Freeze hanya untuk `REVERSED` dan
   `DISPUTE.CREATED`. Dispute menang tidak di-unfreeze otomatis (akun bisa disuspend admin karena alasan lain).
4. **[REV3] "H3 minimum" tidak boleh mengubah error sementara menjadi `needs_review`.** Gateway timeout sesaat
   akan membanjiri alert dan membuat row tak bisa di-rescue, karena `processPaymentSuccess` tidak menerima
   `needs_review`. Aturan yang benar ada di T4.

Koreksi lain: **[REV3]** `transmission_time` window sempit (mis. 5 menit) **tidak boleh** dipakai: PayPal retry
sampai 3 hari dan header mungkin tidak ditandatangani ulang. Perlindungan replay cukup dari idempotensi
(`payment_events` unique) + re-fetch order via API.

---

## 3. Release gate (urutan kerja)

Format: **Task → file → acceptance criteria**. Semua T1–T10 wajib sebelum live.

### T1 — Guard environment PayPal (H1) ⟵ kerjakan pertama
- **File:** `lib/paypal.ts`, `index.ts` (`assertProductionConfig`, sekitar `:15-42`).
- Tambah `assertPaypalConfig()`:
  - Bila `PAYPAL_CLIENT_ID` dan `PAYPAL_CLIENT_SECRET` sama-sama tidak diset → PayPal dianggap nonaktif, log, return
    (deployment Duitku-only tidak boleh crash).
  - Selain itu: production (`NODE_ENV=production`) wajib `PAYPAL_ENVIRONMENT ∈ {live, production}`; non-production
    **dilarang** `live`; production dengan `PAYPAL_WEBHOOK_TEST_BYPASS` diset → throw; production wajib punya
    `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.
- `getBaseUrl()` memakai aturan yang sama dan **melempar**, tidak pernah fallback ke sandbox di production.
- **Acceptance:** boot dengan `NODE_ENV=production` + env kosong/sandbox → proses crash dengan pesan jelas;
  dev tanpa `NODE_ENV` + sandbox tetap jalan; test yang ada tetap lulus.
- Catatan: bila ada staging dengan `NODE_ENV=production` tapi kredensial sandbox, pisahkan dengan `APP_ENV`.

### T2 — Migrasi skema (M5, dikurangi)
- **File:** `packages/db/src/schema.ts` + migrasi drizzle.
- Pada `payments` tambah: `captureId text`, `reconcileCheckedAt timestamptz`,
  `refundedAmountMinorUnits integer NOT NULL DEFAULT 0`; tambah `'needs_review'` dan `'disputed'` ke enum status.
- Index: `payments_open_idx (status, created_at) WHERE status IN ('pending','pending_paypal','capturing')`;
  `payments_capture_unique (capture_id) WHERE capture_id IS NOT NULL`.
- Pada `credit_ledger` tambah `ledger_refund_reference_unique (reference) WHERE entry_type = 'refund'`.
- Tambah `CHECK (status IN (...semua 9 status...))` pada `payments` (`NOT VALID` lalu `VALIDATE`). Drizzle
  `{ enum }` hanya validasi TypeScript; Postgres menerima string apa pun (terkonfirmasi, `schema.ts:362`).
- **TIDAK** mengubah `external_id` dari unique global ke composite `(provider, external_id)`: unique global
  lebih ketat dan tetap benar; perubahan itu migrasi berisiko tanpa manfaat.
- Pre-check sebelum migrasi: tidak ada status di luar 9 nilai; tidak ada `credit_ledger.reference` ganda untuk
  `entry_type='refund'`.
- **Acceptance:** `drizzle-kit generate` bersih; `tsc` lulus (semua tempat yang meng-switch `payment.status`
  dicek terhadap 2 status baru); migrasi sukses di salinan data.

### T3 — Handler refund / reversal / dispute (H5 minimal)
- **File:** `routes/webhooks.ts` (cabang `:328-334`), modul baru (mis. `lib/paypal-post-payment.ts`),
  `lib/payment-state.ts` baru bila perlu.
- Helper baru `transitionPayment(id, fromStatuses, to, tx?)` = `UPDATE ... WHERE id AND status IN (from) RETURNING`.
  `markPaidPayment(id, to)` = `transitionPayment(id, ['paid'], to)`.
- Mapping event → aksi:

| Event | Aksi |
|---|---|
| `PAYMENT.CAPTURE.REFUNDED` | tambah `refundedAmountMinorUnits` (cek currency sama, parse strict); bila total ≥ `amountMinorUnits` → `paid → refunded`, selain itu tetap `paid`. **Tanpa freeze.** Alert: clawback manual (`admin_adjustment`). |
| `PAYMENT.CAPTURE.REVERSED` | `paid → disputed` + `users.suspended = true` + alert |
| `CUSTOMER.DISPUTE.CREATED` | `paid → disputed` + `users.suspended = true` + alert |
| `CUSTOMER.DISPUTE.RESOLVED` | outcome mengandung `SELLER` → `disputed → paid`; `BUYER` → `disputed/paid → refunded`; lainnya → hanya alert. **Tidak** auto-unfreeze; alert meminta unsuspend manual. |

- **Satu transaksi:** insert `payment_events` (`onConflictDoNothing().returning`) + mutasi status + freeze. Bila insert
  tidak mengembalikan baris → event duplikat → no-op (tanpa alert ulang). Alert dikirim **setelah** commit.
- Pencarian payment (urut): `custom_id` (jika UUID valid) → `captureId` → order ID (`externalId`) → fallback API
  `GET /v2/payments/captures/{id}` untuk mengambil `supplementary_data.related_ids.order_id`. Hanya `provider='paypal'`.
  Validasi capture ID `^[A-Za-z0-9]+$` sebelum dipakai di URL.
- Ekstraksi ID (**verifikasi dengan payload sandbox**): `REVERSED` → `resource.id` (capture); `REFUNDED` →
  link `rel="up"` pada resource (capture asal); `DISPUTE.*` → `resource.disputed_transactions[].seller_transaction_id`;
  order ID dari `resource.supplementary_data.related_ids.order_id`.
- Event yang tak bisa dipetakan: insert ke `payment_events` dengan `paymentId = null` (kolom nullable) + alert,
  balas **200** (retry tidak menolong). Error DB → lempar → **5xx** (PayPal retry).
- Backfill `captureId` (best-effort, di luar transaksi, boleh gagal karena unique).
- Redaksi PII (L1): hapus `payer`, `shipping`, `buyer`, `payment_source`, `payer_email`, `email_address`,
  `given_name`, `surname`, `phone*` dari payload sebelum disimpan.
- **Acceptance:** test untuk tiap event (refund penuh, refund parsial, replay event sama, reversal, dispute
  created/won/lost, event tak terpetakan); replay tidak menggandakan `refundedAmountMinorUnits` maupun alert.
- Kebijakan: clawback ledger otomatis **tidak** dibuat di gate ini (alert → `admin_adjustment` manual).

### T4 — Reconcile (H3 + #5 + M7 + M9)
- **File:** `lib/paypal-reconcile.ts`, `index.ts:85-90`.
- Satu dispatcher `reconcileOpenPayments()` (alias `reconcilePaypalPayments` dipertahankan agar import lama tak rusak),
  dengan `settleDuitkuPayment` / `settlePaypalPayment` bersama. `settlePaypalPayment` diekspor karena dipakai route capture (T6).
- **Klaim baris:** query `ORDER BY reconcile_checked_at ASC NULLS FIRST, created_at ASC LIMIT 50`, filter
  `reconcile_checked_at IS NULL OR < now-10m`; sebelum memanggil gateway, `UPDATE payments SET reconcile_checked_at = now()
  WHERE id AND status IN (open) AND (reconcile_checked_at IS NULL OR < now-10m) RETURNING id`; kosong → skip.
- **Aturan expire (inti H3):** hapus `|| tooOld` dari **semua** `catch` (termasuk catch terluar `:186-188`).
  Row hanya di-expire oleh jawaban **eksplisit** gateway: PayPal `PayPalApiError.status === 404` /
  `INVALID_RESOURCE_ID`, atau status terminal `failed`/`expired`; Duitku `statusCode '02'`, atau not-found.
  Gateway menjawab "belum dibayar" (PayPal `pending`, Duitku bukan '00') dan row >24 jam → boleh expire.
- **[REV3] Error sementara (timeout/5xx/jaringan):** row **tetap open** (jangan `needs_review`, jangan expire).
  Bila row >24 jam, kirim alert **maksimal sekali per 24 jam per payment** (pakai `rateLimitStore.increment(
  'notif:payment_stuck:<id>', 86400) === 1`, seperti pola `notifyLowBalance`). Alasan: uang mungkin sudah masuk,
  dan webhook susulan masih bisa menyelamatkan row open/expired.
- **`needs_review` hanya untuk kondisi yang memang tidak boleh dikreditkan:** mismatch nominal/currency/ikatan order,
  atau capture ternyata sudah `refunded` saat row masih open. Selalu disertai `opsAlert`. Ini mengisi `console.error`
  `NEEDS REVIEW` yang sekarang hanya ke log (`:33, :112, :151`) dan menghentikan row mismatch menyumbat antrean.
- `pending_paypal` tetap dikecualikan dari expire berdasarkan umur (sesuai komentar di kode). Perhatikan: cabang expire
  memeriksa `order.effectiveStatus === 'pending'`, bukan `payment.status`; pastikan capture `PENDING` memang menjadi
  `pending_paypal` di `interpretOrder` (sudah, via status capture).
- **M9:** guard `running` pada `setInterval` reconcile agar run lambat tak menumpuk.
- **Acceptance:** test: (a) >50 row open, semua akhirnya terproses; (b) gateway melempar error pada row >24 jam →
  row tetap `pending`, alert sekali; (c) PayPal 404 → expired; (d) mismatch → `needs_review` + alert; (e) dua panggilan
  paralel tidak memproses row yang sama dua kali.

### T5 — Webhook PayPal: pencatatan, binding, rate limit (H2, M3, M8)
- **File:** `routes/webhooks.ts:222-337`, `lib/paypal.ts`, `lib/payment-events.ts`, `app.ts:108-115`.
- **M8:** pre-check murah **sebelum** postback ke PayPal: kelima header `paypal-*` ada, `paypal-cert-url` berskema
  `https` dan host `^([a-z0-9-]+\.)*paypal\.com$`. Tambah per-IP rate limit longgar (mis. 120/menit) memakai
  `ipRateLimit` yang ada — PayPal bisa mengirim burst retry; jangan menahan webhook sah.
- **Catat semua event:** `no_order_id` (`:269`) dan `payment_not_found` (`:281`) kini mengembalikan 200 tanpa jejak.
  Tambah `recordUnmatchedEvent({provider, eventId, payload})` (insert `paymentId = null`, `onConflictDoNothing`,
  return boolean "baru disimpan") dan panggil di kedua cabang. Payload diredaksi (T3).
  **Catatan tipe:** kolom DB `payment_events.payment_id` sudah nullable (`schema.ts:378`), tetapi interface
  `PaymentEventInput.paymentId` masih `string` (non-nullable, `payment-events.ts:15`) — ubah menjadi `string | null`
  agar insert null bisa. Ini bagian dari task T5, bukan file read-only.
- **Dispatch:** event refund/reversal/dispute → handler T3 sebelum logika COMPLETED/DENIED.
- **Row sudah di status review:** bila `payment.status ∈ {needs_review, disputed, refunded}` saat webhook
  `COMPLETED` tiba → catat event, balas **200** (jangan lempar → loop retry 5xx berhari-hari karena
  `processPaymentSuccess` tidak menerima status itu).
- **H2 + M3 (cabang `PAYMENT.CAPTURE.COMPLETED`, `:287-327`):** sebelum `recordAndFulfilPayment`, panggil
  `getOrder(payment.externalId)`; lanjut hanya jika `effectiveStatus === 'paid'` **dan** `capturedOrderMatches` benar.
  Selain itu: catat event + `needs_review` + alert, balas 200. Webhook = pemicu, API = sumber kebenaran.
- **`capturedOrderMatches(o, p)`** (menggantikan `capturedAmountMatches` di semua pemanggil: reconcile `:150`,
  capture route `:526`, webhook `:307`): `o.orderId === p.externalId` **dan** custom_id cocok `p.id` **dan** nominal +
  currency cocok. Tambah `customId` ke `PayPalParsedOrder` (dibaca dari `captures[0].custom_id ?? purchase_units[0].custom_id`).
  **Bila PayPal tidak mengembalikan `custom_id`**, lewati cek itu dengan `console.warn` kecuali env
  `PAYPAL_REQUIRE_CUSTOM_ID=1`; setelah sandbox mengonfirmasi `custom_id` selalu kembali, aktifkan flag itu. (Tanpa
  kelonggaran ini, jika PayPal tak mengembalikan field, semua payment akan masuk `needs_review`.)
- `interpretOrder` (M1): bila ada beberapa capture, pilih `COMPLETED` dulu, lalu `PENDING`, lalu yang pertama;
  `REFUNDED`/`PARTIALLY_REFUNDED` → `effectiveStatus = 'refunded'` (bukan `failed`); semua pemanggil `effectiveStatus`
  harus menangani nilai baru ini (reconcile: row open + refunded → `needs_review`).
- Setiap jalur yang menemukan capture ID menyimpannya (`saveCaptureId`, best-effort, hanya bila `captureId IS NULL`).
- **Acceptance:** test: webhook tanpa header → 400 tanpa memanggil PayPal; cert_url `paypal.com.evil.com` ditolak;
  event tak dikenal tercatat (`payment_id` null); webhook COMPLETED dengan nominal beda → tidak dikreditkan;
  webhook ke row `needs_review` → 200.

### T6 — Route capture (H4 + #4)
- **File:** `lib/paypal.ts` (`captureOrder`), `routes/payments.ts:447-570`.
- `captureOrder(orderId, paymentId)`: header `PayPal-Request-Id: capture:<paymentId>` dan `Prefer: return=representation`;
  bila hasil tanpa `captureStatus`, kembalikan `getOrder(orderId)`. `orderId` di-`encodeURIComponent` pada URL.
- **Klaim atomik** sebelum memanggil PayPal: `UPDATE ... SET status='capturing' WHERE id AND status IN
  ('pending','pending_paypal','failed','expired') RETURNING`. **[REV3]** `failed`/`expired` **sengaja ikut** (late-rescue:
  bila PayPal sudah mengambil uang, kredit harus masuk); saat itu terjadi, `console.warn` keras dengan payment ID
  (artinya state lokal salah). **Jangan** menolak `expired`/`failed` (lihat §7).
- Klaim gagal: bila status sekarang `capturing` (retry setelah timeout/proses lain) → **jangan capture ulang**; panggil
  `settlePaypalPayment(payment, {tooOld:false})` — `paid` → 200, selain itu 202 `processing`. Status lain → 409.
- Penanganan error setelah klaim:
  - `ORDER_ALREADY_CAPTURED` → `getOrder` lalu cek `capturedOrderMatches` (bukan langsung sukses; sudah ada `:512-526`).
  - `INSTRUMENT_DECLINED` (422) → lepas klaim (`capturing → pending`), balas 422 dengan pesan "coba metode lain".
  - 4xx definitif lain (bukan 408/429) → lepas klaim, balas 409.
  - **Timeout / 5xx / jaringan = status TIDAK DIKETAHUI**: **jangan** set `failed`, **jangan** lepas klaim; biarkan
    `capturing`, balas 202; reconcile yang menyelesaikan.
- Hasil: `paid` + `capturedOrderMatches` → `saveCaptureId` + `fulfilPayment`; `pending_paypal` →
  `markPaymentIfOpen(..., 'pending_paypal')`; `failed` → `markPaymentIfOpen(..., 'failed')`; `refunded`/mismatch → `needs_review` + alert.
- Tambah `sessionRateLimit('payments', N)` pada route capture (pola `routes/keys.ts:13`, `routes/redeem.ts:29`);
  route create saat ini hanya dibatasi cek DB 5/jam.
- **Acceptance:** dua request capture paralel → hanya satu memanggil PayPal; timeout buatan → baris tetap `capturing`
  lalu reconcile menyelesaikan; INSTRUMENT_DECLINED → baris kembali `pending` dan bisa dicoba lagi.

### T7 — Create order (M2)
- **File:** `lib/paypal.ts` (`createOrder`), `routes/payments.ts:324-443` (route `POST /paypal/create-order`). Catatan: `:32-208` adalah route Duitku `/create`, bukan PayPal — jangan tertukar.
- Throw bila link `approve`/`payer-action` tidak ditemukan (kini mengembalikan `''`, `:234-240`).
- Amount string dari integer cents: helper `centsToPaypalAmount(cents)` = `(cents/100).toFixed(2)`, validasi integer ≥ 0;
  `createOrder` memvalidasi `^\d+(\.\d{1,2})?$`.
- Opsional `return_url`/`cancel_url` via `payment_source.paypal.experience_context`.
- `paypalAmountToCents` strict (L6): regex `^\d+(\.\d{1,2})?$`, hitung dari string (bukan `Math.round(Number*100)`),
  throw pada format tak terduga; `capturedAmountMatches` membungkusnya dalam try/catch → `false`.
- Catatan bisnis (verifikasi sebelum live): setahuku PayPal tidak mendukung IDR sebagai currency transaksi; pastikan
  alur harga memakai currency yang didukung (mis. USD) dan kurs dikunci server-side di row payment (sudah, `payments.ts:159`).

### T8 — Alerting `needs_review` (#8)
- Semua jalur yang menulis `needs_review` memanggil `opsAlert()` (T3/T4/T5). Tidak ada `console.error` saja.
- **Acceptance:** memicu mismatch di sandbox → pesan Telegram/webhook terkirim.

### T9 — Konfigurasi dashboard PayPal (non-kode)
Webhook **live** harus subscribe: `PAYMENT.CAPTURE.COMPLETED`, `.DENIED`, `.PENDING`, `.REFUNDED`, `.REVERSED`,
`CHECKOUT.ORDER.VOIDED`, `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.RESOLVED`. Webhook ID sandbox ≠ live; `PAYPAL_WEBHOOK_ID`
production harus ID live.

### T10 — Sandbox end-to-end + smoke test live
Lihat §9. Wajib lulus sebelum go-live.

---

## 4. Temuan Medium/Low yang bisa menyusul (minggu pertama)

- **Clawback otomatis:** ledger `entryType:'refund'` bernilai negatif, `reference = refund:<paypal_refund_id>`
  (bukan capture ID), memakai `grantCredits` (`billing.ts:349`) + unique index T2. Saldo negatif sudah diblokir di
  jalur API.
- **Paket entitlement** (`pkg.modelId`, `billing.ts:476-487`) menulis ke `entitlements`, bukan `credit_ledger`. Refund/dispute
  atas pembelian jenis ini harus mengubah entitlement menjadi `revoked`, bukan menulis ledger negatif. Belum tercakup di T3.
- **M4:** `PAYPAL_WEBHOOK_TEST_BYPASS` (`paypal.ts:353-355`) **double-gated** (`NODE_ENV === 'test' && flag === '1'`), jadi
  **tidak reachable di production** selama `NODE_ENV` benar — bukan bug, hanya wording rev sebelumnya yang longgar. T1 menambah
  larangan eksplisit flag ini di production; lebih bersih injeksi verifier di test (`vi.mock`).
- **M6:** token OAuth stampede (`paypal.ts:28-62`) → simpan promise in-flight (`inflight ??= fetchToken().finally(() => inflight = null)`).
- **M10:** webhook memverifikasi body hasil parse (`webhooks.ts:223→226→239`). Biasanya berfungsi; bila ada
  `invalid signature` sporadis pada event sah, pindah ke verifikasi offline atas raw body (`node:crypto` + sertifikat dari `paypal-cert-url`,
  host divalidasi).
- **L1:** retensi `payment_events.payload` + redaksi PII (redaksi dasar sudah di T3).
- **L3:** `expiryPeriod` Duitku selalu = `DUITKU_PAYMENT_TTL_MINUTES` (jadikan default di `createTransaction`). Bila tidak,
  row lokal expired di menit ke-5 sementara QR bisa dibayar sampai menit ke-60.
- **L4:** `assertDuitkuConfig` di production `throw` (bukan `warn`) bila merchant code/API key kosong; verifikasi
  `assertProductionConfig` (`index.ts:26-39`) tetap menjamin itu.
- **L5:** `void notifyPaymentPaid` bisa hilang di serverless; outbox/queue bila pernah pindah.
- **L7:** koreksi komentar `PaymentEventInput` (`payment-events.ts:8-11`): yang idempoten adalah `processPaymentSuccess`/
  `markPaymentIfOpen`, `payment_events` hanya mencegah duplikasi baris audit. Tambah `recordUnmatchedEvent` (T5).
- **Duitku:** deteksi not-found lewat substring pesan error rapuh; lebih baik error bertipe dari `lib/duitku.ts`.
- **Duitku/QRIS** tidak punya webhook refund → prosedur manual (`admin_adjustment`); dokumentasikan untuk operator.

---

## 5. Spesifikasi skema (ringkas)

```ts
// payments — tambahan
captureId: text('capture_id'),
reconcileCheckedAt: timestamp('reconcile_checked_at', { withTimezone: true }),
refundedAmountMinorUnits: integer('refunded_amount_minor_units').notNull().default(0),
// status enum: + 'needs_review', 'disputed'
// index: payments_open_idx (partial), payments_capture_unique (partial unique)
// credit_ledger: ledger_refund_reference_unique (partial unique WHERE entry_type='refund')
// + CHECK constraint status IN (9 nilai)
```

---

## 6. Jawaban checklist verifikasi (terhadap source)

1. **`processPaymentSuccess`** — atomik **ya** (`billing.ts:438-447`). Status diterima: `pending, pending_paypal, capturing,
   failed, expired`; `refunded` dikecualikan (benar). Referensi ledger `payment:<id>` (`:494, :506`). Satu transaksi dengan perubahan saldo (`:518`).
   Entitlement menulis ke `entitlements`, bukan ledger (`:476-487`).
2. **`markPaymentIfOpen`** — kondisional **ya** (`billing.ts:406-424`); open = `pending, pending_paypal, capturing`; tak pernah menimpa `paid`
   (**sebab itu tak cocok untuk H5**, lihat §2.1).
3. **Route create** — harga/kredit server-side **ya** (`payments.ts:114, :161`); kurs terkunci di row (`:159`); batas 5/jam (`:69-89`).
   Tidak ada `sessionRateLimit` (`:23-24`).
4. **Route capture** — auth middleware **ya** (`:23-24`), kepemilikan di handler **ya** (`:470-474`); klaim atomik `capturing` **tidak ada** (status mati); penolakan
   `expired/failed` **sengaja tidak ada** (benar); `isAlreadyCapturedError` → `getOrder` **ya** (`:507-516`);
   `INSTRUMENT_DECLINED` **tidak dipetakan** (`:515-520`); user suspended diblokir **ya** (`session-auth.ts:100`).
5. **Webhook PayPal** — raw body dibaca **ya tapi dibuang** (`:223→226`); verifikasi paling awal **ya** (`:239`); lookup via `custom_id` **tidak**
   (hanya `externalId`, `:276`); event tak dikenal dibalas 200 **tanpa** `recordPaymentEvent` (`:269, :281`); error DB → 5xx **ya** (`:326`).
6. **Callback Duitku** — `merchantCode` implisit (bagian string yang ditandatangani, `duitku.ts:210`); hanya `resultCode '00'` di-fulfil;
   nominal dicocokkan DB + re-verify API; `eventId` diberi akhiran `:resultCode` sehingga tidak bentrok.
7. **Handler refund/dispute** — tidak ada (T3).
8. **Scheduler reconcile** — satu pemanggil `setInterval` (`index.ts:85-90`), 15 menit; tanpa alert (`sendOpsAlert` ada tapi tidak dipanggil).

---

## 7. Sudah termitigasi / JANGAN diimplementasikan

| Klaim | Kenyataan |
|---|---|
| `deletedAt` tak dicek di `sessionAuth` → user terhapus bisa bayar | **Salah.** `softDeleteUser` (`lib/account-deletion.ts:10-34`) set `suspended=true` dan menghapus semua sesi dalam satu transaksi; `sessionAuth` menolak `suspended`. |
| Tidak ada infrastruktur alert | **Salah.** `sendOpsAlert()` sudah ada; yang kurang hanya pemanggilan dari reconcile/webhook. |
| Webhook tanpa batas ukuran body | **Salah.** 1 MB `bodyLimit` aktif (`app.ts:59-71`). Hanya rate limit yang kurang. |
| Saldo negatif membuat clawback sia-sia | **Salah.** `pickSource` menolak saldo ≤ 0. |
| `/receipt/:paymentId` rawan IDOR | **Aman.** Route di `payments.ts:212`, filter `userId` di `payments.ts:236`. |
| **Tolak `expired`/`failed` di route capture** | **JANGAN.** `processPaymentSuccess` sengaja menerima keduanya (late-rescue). Menolak = uang masuk, kredit tidak. |
| Window `transmission_time` sempit | **JANGAN** (lihat §2). |
| Ubah `externalId` jadi composite unique | **Tidak perlu** (T2). |
| Auto-freeze pada `REFUNDED` / auto-unfreeze setelah dispute menang | **JANGAN** (lihat §2.3). |

---

## 8. Catatan deploy VPS

- Bind API ke `127.0.0.1`, TLS di nginx. Bila port API terbuka ke internet, `getTrustedClientIp` tak bermakna dan rate limit per IP bisa dipalsukan.
- Jalankan **satu** instance API. Dengan klaim T4 multi-instance aman, tetapi tetap disarankan satu sampai T4 terbukti.
- `REDIS_URL` wajib diset; tanpa itu rate limiter jatuh ke in-memory (reset saat restart, tak terkoordinasi).
- Production: `NODE_ENV=production`, `PAYPAL_ENVIRONMENT=live`, `DUITKU_ENV=production`, `PAYPAL_WEBHOOK_TEST_BYPASS` tidak diset.
  `assertPaypalConfig()` dan `assertDuitkuConfig()` harus hard-exit di production.

---

## 9. Sandbox end-to-end (wajib sebelum live)

Simulator webhook tidak cukup (postback verification tidak mendukung mock event). Pakai transaksi sandbox sungguhan.

| Skenario | Hasil yang diharapkan |
|---|---|
| Bayar normal | `paid`, kredit sekali, `capture_id` terisi |
| Capture dikirim dua kali / klik ganda | kredit tetap sekali |
| Timeout buatan saat capture | baris `capturing`, reconcile menyelesaikan, **bukan** `failed` |
| Webhook COMPLETED tiba sebelum respons capture | kredit sekali |
| Webhook sama dikirim 2× | no-op |
| Kartu ditolak (`INSTRUMENT_DECLINED`) | baris kembali `pending`, bisa coba lagi |
| Capture `PENDING` | `pending_paypal`, tidak di-expire karena umur |
| Mismatch nominal | `needs_review` + alert terkirim |
| Refund penuh dari dashboard | `refunded`, alert, akun **tidak** dibekukan |
| Refund parsial | tetap `paid`, `refundedAmountMinorUnits` naik, alert |
| Dispute dibuka | `disputed`, akun `suspended`, alert |
| Dispute dimenangkan | kembali `paid`, alert meminta unsuspend manual |
| Webhook COMPLETED ke row `needs_review` | 200, tidak ada retry 5xx |
| >50 row open | semua akhirnya terproses (tidak ada starvation) |

**Verifikasi payload nyata** untuk `REFUNDED`, `REVERSED`, `DISPUTE.CREATED/RESOLVED`: ambil satu payload tiap event dari
`payment_events`, cocokkan capture ID, order ID, `custom_id`, `dispute_outcome.outcome_code` dengan ekstraksi di T3.
Cek juga apakah `custom_id` kembali di order/capture; bila ya, set `PAYPAL_REQUIRE_CUSTOM_ID=1`.

**Smoke test live:** satu transaksi terkecil sungguhan, refund sendiri, pastikan event `REFUNDED` tiba, tercatat, dan alert terkirim.

---

## 10. Prioritas

| Prio | Task | Alasan |
|---|---|---|
| **P0** | T1 guard environment | 10 menit; kegagalannya diam-diam dan fatal |
| **P0** | T2 skema + T3 handler refund/dispute | refund = kredit gratis yang tak pernah ditarik |
| **P1** | T4 reconcile | row bisa salah di-expire; antrean bisa macet |
| **P1** | T5 webhook (catat semua event, binding, rate limit) | audit trail + manipulasi payload |
| **P1** | T8 alerting | uang bisa nyangkut tanpa ada yang tahu |
| **P2** | T6 capture route, T7 create order | korektness/UX, bukan kebocoran uang |
| **P2** | T9/T10 dashboard + sandbox | gate rilis |
| **P3** | §4 | cleanup |

---

## 11. Rencana Pengerjaan Bertahap (4 Fase)

Dipecah agar bisa dicicil antar sesi, tiap fase dapat berdiri sendiri dan diuji sebelum lanjut.
Batas scope §0A tetap berlaku penuh di setiap fase.

```
FASE 1 ──► FASE 2 ──► FASE 3 ──► FASE 4
T1, T2     T3, T8     T4, T5     T6, T7, T9, T10
```

### Fase 1 — Fondasi (T1 + T2)

**Target: kode bisa boot aman di production, skema siap untuk semua fase berikutnya.**

| Task | Ringkasan | File yang disentuh |
|---|---|---|
| T1 | `assertPaypalConfig()`: guard env PayPal saat boot | `lib/paypal.ts`, `index.ts` |
| T2 | Tambah kolom + enum + index ke skema & migrasi | `packages/db/src/schema.ts`, 1 file migrasi baru |

**Urutan dalam fase:**
1. Kerjakan T1 dulu (paling cepat, ~10 menit, tidak bergantung skema).
2. Kerjakan T2: generate migrasi, jalankan di salinan DB, verifikasi `tsc --noEmit`.

**Gate keluar fase 1:**
- [ ] `NODE_ENV=production` + env kosong → proses crash dengan pesan jelas
- [ ] `tsc --noEmit` lulus; tidak ada import baru yang rusak
- [ ] Kolom `captureId`, `reconcileCheckedAt`, `refundedAmountMinorUnits`, status `needs_review` & `disputed` ada di schema + DB
- [ ] Migrasi sukses di salinan data

**Dependensi ke fase berikutnya:** T3, T4, T5 semuanya butuh kolom T2 dan enum baru. Jangan mulai fase 2 sebelum fase 1 lulus.

---

### Fase 2 — Keamanan Finansial (T3 + T8)

**Target: refund/reversal/dispute ditangani; semua jalur `needs_review` kirim alert.**

| Task | Ringkasan | File yang disentuh |
|---|---|---|
| T3 | Handler `REFUNDED`, `REVERSED`, `DISPUTE.*`; `transitionPayment`; redaksi PII | `lib/paypal-post-payment.ts` (baru), `lib/payment-state.ts` (baru), `routes/webhooks.ts` |
| T8 | Pastikan semua jalur `needs_review` panggil `opsAlert()` | file yang sudah disentuh T3 saja |

**Urutan dalam fase:**
1. Buat `lib/payment-state.ts` dengan `transitionPayment` + `markPaidPayment`.
2. Buat `lib/paypal-post-payment.ts` dengan handler tiap event (mapping di §3 T3).
3. Tambah dispatch di `routes/webhooks.ts` sebelum cabang COMPLETED/DENIED.
4. T8: cek semua jalur `needs_review` di file yang baru dibuat sudah panggil `opsAlert()`.

**Gate keluar fase 2:**
- [ ] Test: refund penuh → `refunded`, alert terkirim, akun **tidak** dibekukan
- [ ] Test: refund parsial → tetap `paid`, `refundedAmountMinorUnits` naik, alert terkirim
- [ ] Test: reversal → `disputed`, `users.suspended = true`, alert
- [ ] Test: dispute created → `disputed`, suspended, alert
- [ ] Test: dispute menang seller → `paid`, alert minta unsuspend manual
- [ ] Test: dispute menang buyer → `refunded`, alert
- [ ] Test: replay event sama → no-op (tidak gandakan `refundedAmountMinorUnits`)
- [ ] Test: event tak terpetakan → insert `paymentId = null`, balas 200
- [ ] `tsc --noEmit` lulus

**Dependensi ke fase berikutnya:** T5 akan mendispatch ke handler T3; pastikan T3 sudah di-export dan stabil sebelum lanjut.

---

### Fase 3 — Hardening (T4 + T5)

**Target: reconcile tidak salah expire row; semua webhook dicatat; rate limit terpasang.**

| Task | Ringkasan | File yang disentuh |
|---|---|---|
| T4 | Fix expire-on-error, tambah `needs_review` + alert stuck, guard `running` | `lib/paypal-reconcile.ts`, `index.ts` (hanya blok interval) |
| T5 | Pre-check header, cert-url, rate limit, `recordUnmatchedEvent`, re-fetch `getOrder`, `capturedOrderMatches`, `PaymentEventInput` nullable | `routes/webhooks.ts`, `lib/paypal.ts`, `lib/payment-events.ts`, `app.ts` |

**Urutan dalam fase:**
1. T4 dulu (berdiri sendiri, tidak bergantung T5).
2. T5: ubah `PaymentEventInput.paymentId` ke `string | null`, tambah `recordUnmatchedEvent`, lalu perbaiki webhook route.

**Perhatian T4 — perubahan perilaku kritis:**
- Hapus `|| tooOld` dari semua `catch` (termasuk catch terluar `:186-188`).
- Error transient → row **tetap open**, alert rate-limited sekali per 24 jam.
- `needs_review` hanya untuk mismatch nominal/currency, bukan error transient.
- Guard `running` pada `setInterval` (flag boolean, reset di `finally`).

**Perhatian T5 — urutan perubahan:**
- Pre-check header sebelum memanggil `verifyWebhookSignature` (fail early, hemat 1 PayPal API call).
- `capturedOrderMatches` menggantikan `capturedAmountMatches` di webhook (tambah cek `orderId` + `customId`).
- Bila `custom_id` tidak kembali dari PayPal → `console.warn`, skip cek itu (jangan blokir), kecuali `PAYPAL_REQUIRE_CUSTOM_ID=1`.

**Gate keluar fase 3:**
- [ ] Test T4(a): gateway timeout pada row >24 jam → row tetap `pending`, alert terkirim sekali
- [ ] Test T4(b): PayPal 404 → `expired`
- [ ] Test T4(c): mismatch nominal → `needs_review` + alert
- [ ] Test T4(d): dua panggilan paralel tidak proses row yang sama dua kali (guard `running`)
- [ ] Test T5: webhook tanpa header → 400, tanpa memanggil PayPal
- [ ] Test T5: `paypal-cert-url` dengan host tidak valid → 401
- [ ] Test T5: event tak dikenal → tercatat di `payment_events` (`paymentId = null`)
- [ ] Test T5: webhook COMPLETED nominal beda → tidak dikreditkan, `needs_review`
- [ ] Test T5: webhook ke row `needs_review` → 200, tidak loop retry
- [ ] `tsc --noEmit` lulus

---

### Fase 4 — Polish & Go-Live (T6 + T7 + T9 + T10)

**Target: UX capture lebih robust, create order ketat, konfigurasi live, sandbox lulus.**

| Task | Ringkasan | File yang disentuh |
|---|---|---|
| T6 | Klaim atomik `capturing`, handling `INSTRUMENT_DECLINED`, timeout → 202, `sessionRateLimit` | `lib/paypal.ts`, `routes/payments.ts` |
| T7 | Throw bila no approve URL; `centsToPaypalAmount`; `paypalAmountToCents` strict | `lib/paypal.ts`, `routes/payments.ts` |
| T9 | Konfigurasi webhook live di dashboard PayPal (non-kode) | — |
| T10 | Skenario sandbox end-to-end (lihat §9) | — |

**Urutan dalam fase:**
1. T7 dulu (perubahan di `paypal.ts` lebih awal, dipakai T6 juga).
2. T6: tambah klaim `capturing`, error classifier, rate limit.
3. T9: konfigurasi dashboard PayPal (subscribe semua event yang diperlukan).
4. T10: jalankan seluruh skenario §9, dokumentasikan hasilnya.

**Gate keluar fase 4 (= gate go-live):**
- [ ] Test T6: dua request capture paralel → hanya satu memanggil PayPal
- [ ] Test T6: timeout buatan → baris tetap `capturing`, reconcile menyelesaikan
- [ ] Test T6: `INSTRUMENT_DECLINED` → baris kembali `pending`, bisa coba lagi
- [ ] Test T7: tidak ada approve URL → throw (bukan kembalikan `''`)
- [ ] Seluruh skenario §9 lulus di sandbox
- [ ] Smoke test live: 1 transaksi kecil + self-refund + konfirmasi event `REFUNDED` tercatat
- [ ] `tsc --noEmit` lulus final

---

### Checklist Status Fase (update tiap selesai)

| Fase | Status | Tanggal selesai |
|---|---|---|
| Fase 1 — Fondasi (T1, T2) | ⬜ Belum dimulai | — |
| Fase 2 — Keamanan Finansial (T3, T8) | ⬜ Belum dimulai | — |
| Fase 3 — Hardening (T4, T5) | ⬜ Belum dimulai | — |
| Fase 4 — Polish & Go-Live (T6, T7, T9, T10) | ⬜ Belum dimulai | — |