# LAPORAN TAHAP B3: FR-GW (Gateway API & Reverse Proxy)

**Tanggal Audit:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Modul:** FR-GW-01..12, SR-06, PROXY-01..13, INJ-01..04, AI-01..13, NFR-01..10, API-GW-01..04, API-GW-HDR, API-GW-RESPHDR, API-ERR-SCHEME, API-ERR-CODES, API-ERR-NOLEAK, OPS-SLO-01..02, OPS-ALT-03..04  
**File Kode Diperiksa:**
- [`apps/api/src/routes/v1.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/routes/v1.ts)
- [`apps/api/src/domain/router.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/domain/router.ts)
- [`apps/api/src/domain/circuit-breaker.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/domain/circuit-breaker.ts)
- [`apps/api/src/ratelimit.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/ratelimit.ts)
- [`apps/api/src/middleware/auth.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/middleware/auth.ts)
- [`apps/api/src/middleware/logger.ts`](file:///c:/Users/esc/Desktop/morphic/apps/api/src/middleware/logger.ts)
- [`packages/db/src/billing.ts`](file:///c:/Users/esc/Desktop/morphic/packages/db/src/billing.ts)
- [`packages/shared/src/credits.ts`](file:///c:/Users/esc/Desktop/morphic/packages/shared/src/credits.ts)
- [`packages/shared/src/types.ts`](file:///c:/Users/esc/Desktop/morphic/packages/shared/src/types.ts)
- [`packages/shared/src/models.ts`](file:///c:/Users/esc/Desktop/morphic/packages/shared/src/models.ts)
- [`packages/db/src/schema.ts`](file:///c:/Users/esc/Desktop/morphic/packages/db/src/schema.ts)

---

## 1. Tabel Pemetaan Kebutuhan PRD (FR-GW-01 s/d FR-GW-12)

| ID PRD | Kebutuhan PRD | Prioritas / Fase | Status | Bukti Kode (file:baris) | Penjelasan & Bukti Lapangan |
|---|---|---|---|---|---|
| **FR-GW-01** | Endpoint chat completions kompatibel OpenAI (dengan streaming SSE). SDK populer berjalan hanya ganti `base_url` dan key. | M (Must) / Fase 1 | **PARTIAL** | `v1.ts:94-519`; `router.ts:171-189` | **Terpenuhi:** Endpoint `POST /v1/chat/completions` menerima JSON OpenAI dan mendukung streaming SSE via `streamSSE` (`v1.ts:380-475`). Format chunk `data: {...}\n\ndata: [DONE]` diteruskan langsung.<br>**Gap / Deviasi:** (1) Header `stream_options: { include_usage: true }` tidak disuntikkan otomatis ke upstream, sehingga jika model tidak mengirim `usage`, token dihitung pakai tebakan kasar (`v1.ts:444`); (2) Endpoint completions lama (`POST /v1/completions`) tidak didukung. |
| **FR-GW-02** | Endpoint daftar model sesuai plan/scope. Model di luar scope tidak tampil dan ditolak jika dipanggil. | M (Must) / Fase 1 | **PARTIAL** | `v1.ts:20-49, 51-91` | **Terpenuhi:** Endpoint `GET /v1/models` dan `GET /v1/models/:id` ada dan mengembalikan struktur OpenAI (`object: 'list'`, `object: 'model'`).<br>**Gagal / Hilang:** Filter berdasarkan plan/scope key **tidak ada**. Semua key melihat seluruh model yang berstatus `active` atau `deprecated`. Model di luar hak akses tidak diblokir di level authorization. |
| **FR-GW-03** | Endpoint embeddings. Biaya dihitung per token input. | S (Should) / Fase 2 | **MISSING** | — | Endpoint `POST /v1/embeddings` belum diimplementasikan di router `v1.ts`. (Sesuai rencana PRD, fitur ini dialokasikan untuk Fase 2). |
| **FR-GW-04** | Routing alias model → model hulu + pool key hulu. Alias terdokumentasi; pergantian hulu tercatat. | M (Must) / Fase 1 | **PARTIAL** | `router.ts:42-67, 101-153`; `schema.ts:101-125` | **Terpenuhi:** Resolusi alias publik (`s.models.publicModelId`) ke provider model ID hulu (`s.models.providerModelId`) dan pergantian model deprecated ke replacement alias (`router.ts:108-118`).<br>**Hilang:** **Tidak ada upstream key pool / rotasi dinamis**. Setiap provider hanya memiliki 1 kredensial tunggal di tabel `providers` (`schema.ts:110-111`), tanpa entitas `upstream_keys` atau rotasi kuota antar-key hulu. |
| **FR-GW-05** | Retry/fallback terkontrol + circuit breaker. Retry tidak menagih ganda; batas retry jelas. | M (Must) / Fase 1 | **PARTIAL** | `circuit-breaker.ts:8-94`; `router.ts:101-153`; `v1.ts:278-373` | **Terpenuhi:** Circuit breaker state (`closed`, `open`, `half-open`) dengan threshold 5 kegagalan per 60 detik (`circuit-breaker.ts:4-6`). Provider fallback dipilih jika primary provider circuit open (`router.ts:129-150`).<br>**Gap Kritis:** **Tidak ada runtime retry/failover**. Jika panggilan primer gagal saat eksekusi (`v1.ts:278, 325`), gateway langsung mengembalikan 502/504 ke klien tanpa mencoba fallback provider! Selain itu, state CB disimpan di DB PostgreSQL per-request. |
| **FR-GW-06** | Validasi request: ukuran body, jumlah pesan, max_tokens, parameter. Melebihi batas → 413/400. | M (Must) / Fase 1 | **PARTIAL** | `types.ts:11-26`; `v1.ts:100-155` | **Terpenuhi:** Parsing skema Zod `chatCompletionRequestSchema` memvalidasi keberadaan `model`, `messages` array, dan `stream` boolean.<br>**Gagal / Hilang:** (1) **Tidak ada pembatasan ukuran payload body** (Content-Length / Body Limit) di Hono sebelum `c.req.json()`; (2) Tidak ada batas maksimum jumlah pesan (`messages.length`); (3) Parameter numerik (`temperature`, `top_p`, `frequency_penalty`) tidak divalidasi batas rentangnya. |
| **FR-GW-07** | Metering real-time (token input/output, latensi, status). Setiap request menghasilkan satu usage event unik. | M (Must) / Fase 1 | **IMPLEMENTED** | `logger.ts:24-28`; `billing.ts:220-237`; `v1.ts:287-315, 332-360, 447-474, 489-516` | Setiap request menghasilkan satu record di `s.requestLogs` (fire-and-forget) dan satu record di `s.usageRecords` (transaksional ACID). Token prompt, completion, total, latensi, gateway latensi, dan status tersimpan lengkap. |
| **FR-GW-08** | Format error standar + request_id. Semua error memakai skema §14.4; tanpa stack trace. | M (Must) / Fase 1 | **PARTIAL** | `router.ts:209-256`; `v1.ts:75, 121, 144, 176, 208, 257, 318, 363` | **Terpenuhi:** Error upstream dinormalisasi ke format OpenAI-compatible `{ error: { message, type, code } }` tanpa membocorkan stack trace internal.<br>**Deviasi:** Field `request_id` **tidak disertakan di dalam JSON body error**, melanggar skema PRD §14.4 (`{ "error": { "type": "...", "code": "...", "message": "...", "request_id": "..." } }`). |
| **FR-GW-09** | Header rate limit & X-Request-Id. Header Retry-After pada respons 429. | M (Must) / Fase 1 | **MISSING** | `auth.ts:81-100`; `v1.ts:95-98` | Header `Retry-After`, `X-RateLimit-Limit-Requests`, dan `X-RateLimit-Remaining-Requests` tidak pernah disuntikkan pada respons HTTP 429. Header `X-Request-Id` juga tidak di-set pada response header klien gateway. |
| **FR-GW-10** | Pembatalan upstream saat klien disconnect. Konsumsi hulu berhenti; tagihan sesuai token terpakai. | M (Must) / Fase 1 | **VIOLATION** | `router.ts:180-186`; `v1.ts:276` | **Pelanggaran Kritis:** Di `router.ts:180-186`, adapter provider membuat `timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)` dan hanya meneruskan `timeoutSignal` ke `fetch()`. **Parameter `req.signal` (client disconnect signal dari Hono) diabaikan sepenuhnya**. Koneksi hulu tetap jalan sampai timeout 55 detik meskipun klien sudah disconnect. |
| **FR-GW-11** | Tidak menyimpan isi prompt/respons secara default (zero-retention). Log hanya metadata. | M (Must) / Fase 1 | **IMPLEMENTED** | `logger.ts:3-18`; `schema.ts:143-162, 173-196` | Mematuhi prinsip zero-retention 100%. Skema database `request_logs` dan `usage_records` sama sekali tidak menyediakan kolom penampung teks prompt atau teks completion. Hanya metadata token, latensi, status, dan ID yang dicatat. |
| **FR-GW-12** | Informasi model yang dilayani pada respons (`model`) konsisten dengan yang ditagih. | M (Must) / Fase 1 | **IMPLEMENTED** | `v1.ts:186-188, 232, 292, 337, 452, 494`; `router.ts:108-118` | Model yang ditagih di `billing.settle` selalu menggunakan `route.pricing` dan `route.modelId` dari rute model yang sebenarnya dieksekusi. Jika dialihkan akibat deprecation, header `X-Morphic-Warning` menyertakan keterangan pengalihan. |

---

## 2. Tabel Pemetaan Kontrol Keamanan Gateway

| ID Kontrol | Deskripsi Kontrol Keamanan | Status | Bukti Kode (file:baris) | Evaluasi & Rekomendasi Auditor |
|---|---|---|---|---|
| **PROXY-01** | Gateway bertindak sebagai reverse proxy murni; dilarang menyimpan prompt/respons di persistent store. | **IMPLEMENTED** | `logger.ts:3-18`; `schema.ts:173-196` | Tidak ada persistence teks prompt/respons. Memenuhi persyaratan privasi dan keamanan AI. |
| **PROXY-02** | Cegah SSRF — URL provider hulu dilarang diambil dari input klien; wajib dari konfigurasi internal. | **IMPLEMENTED** | `router.ts:56, 174` | URL endpoint hulu diambil dari kolom `providers.baseUrl` di PostgreSQL yang dikonfigurasi admin. Input klien hanya menentukan nama alias model. |
| **PROXY-03** | Validasi skema request body sebelum diteruskan ke hulu (Zod/Joi). | **IMPLEMENTED** | `types.ts:11-26`; `v1.ts:102, 125` | Validasi menggunakan Zod schema `chatCompletionRequestSchema`. Request tidak valid ditolak di gateway dengan HTTP 400. |
| **PROXY-04** | Batasi ukuran body request (mis. max 10 MB) untuk mencegah DoS/memory exhaustion. | **FAILED** | `v1.ts:102` | Hono route tidak memasang middleware `bodyLimit`. Payload berukuran ratusan MB dapat membebani memori V8 proses API (CWE-400). |
| **PROXY-05** | Tangani disconnect klien — batalkan request ke hulu jika klien putus koneksi. | **FAILED** | `router.ts:180-186` | Adapter fetch mengabaikan `req.signal` klien. Upstream fetch tidak dibatalkan saat klien abort. |
| **PROXY-06** | Circuit breaker per provider hulu untuk mencegah cascading failure. | **PARTIAL** | `circuit-breaker.ts:43-94` | Logika state machine (closed/open/half-open) ada, tetapi persistensi state via PostgreSQL membebani database, dan tidak ada runtime failover. |
| **PROXY-07** | Error hulu dinormalisasi — dilarang meneruskan pesan internal / stack trace hulu mentah ke klien. | **IMPLEMENTED** | `router.ts:216-255`; `v1.ts:318, 363` | Status upstream dipetakan rapi ke HTTP 429, 502, 503, 504 dengan kode error generik (`provider_timeout`, `provider_error`, `provider_rate_limited`). |
| **PROXY-08** | Timeout request ke hulu terdefinisi ketat. | **PARTIAL** | `router.ts:22, 180` | Timeout global 55 detik (`UPSTREAM_TIMEOUT_MS`) terpasang. Namun tidak ada timeout terpisah untuk connect timeout vs read timeout. |
| **PROXY-09** | Model mapping transparan — dilarang silent-substitution ke model lebih murah tanpa deklarasi. | **IMPLEMENTED** | `router.ts:108-118`; `v1.ts:186-188` | Pengalihan model hanya terjadi pada model deprecated dan dideklarasikan eksplisit via header `X-Morphic-Warning`. |
| **PROXY-10** | Pool API key hulu mendukung rotasi dinamis dan load balancing. | **MISSING** | `router.ts:37-38`; `schema.ts:110-111` | Hanya 1 kredensial tunggal per penyedia hulu. Tidak ada entitas tabel pool key hulu maupun algoritma round-robin rotasi kuota. |
| **PROXY-11** | Header hop-by-hop dan header sensitif klien dibersihkan sebelum diteruskan ke hulu. | **IMPLEMENTED** | `router.ts:177-178` | Request hulu dibuat ulang secara bersih dengan header minimal: `content-type`, `connection: close`, dan kredensial penyedia hulu. API key klien tidak pernah diteruskan ke hulu. |
| **PROXY-12** | Response streaming (SSE) diteruskan chunk-by-chunk tanpa buffering seluruh respons di memori. | **IMPLEMENTED** | `v1.ts:380-395` | Menggunakan `streamSSE` Hono dan `reader.read()` untuk menulis langsung chunk teks ke socket klien secara streaming real-time. |
| **PROXY-13** | Metering token dihitung dari respons hulu (usage object) atau tokenizer lokal terverifikasi. | **PARTIAL** | `v1.ts:404, 444, 483` | Respons non-streaming membaca `j.usage`. Namun pada streaming SSE tanpa `usage` hulu, sistem menggunakan tebakan kasar `chunksReceived * 8`. |
| **INJ-01** | Input validation ketat di semua endpoint publik. | **IMPLEMENTED** | `types.ts:11-26`; `v1.ts:102` | Zod schema memvalidasi tipe data setiap parameter input. |
| **AI-02** | Zero retention prompt/response policy. | **IMPLEMENTED** | `schema.ts:143-162, 173-196` | Tidak ada tabel atau kolom yang menyimpan konten prompt atau respons AI. |
| **AI-11** | Data pelanggan tidak dipakai untuk pelatihan AI model internal. | **IMPLEMENTED** | — | Konsekuensi langsung dari zero retention: tidak ada data percakapan yang disimpan di sistem. |

---

## 3. Temuan Keamanan & Kepatuhan — Diurutkan Berdasarkan Risiko

### 🟠 TINGGI — T-B3-01: Client Abort Signal Diabaikan; Request Hulu Tidak Dibatalkan Saat Klien Disconnect
- **ID PRD Terkait:** FR-GW-10, PROXY-05, NFR-08
- **Butir Audit:** PROXY-05 (Client Disconnect Handling)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/domain/router.ts:180-187`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\domain\router.ts#L180-L187):
  ```typescript
  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: timeoutSignal, // <-- req.signal yang dikirim dari v1.ts diabaikan!
  });
  ```
  [`apps/api/src/routes/v1.ts:276`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\v1.ts#L276):
  ```typescript
  upstream = await callProvider({
    route,
    body: body as unknown as Record<string, unknown>,
    stream: wantsStream,
    signal: c.req.raw.signal, // <-- Dikirim ke callProvider tapi tidak pernah dipakai di OpenAiCompatibleAdapter
  });
  ```
- **Dampak Keamanan & Bisnis:**
  1. **Pemborosan Biaya Hulu (Financial Drain):** Ketika klien memutuskan koneksi (misal pengguna membatalkan generasi teks di UI atau koneksi mobile terputus), fetch ke penyedia hulu (OpenAI/Anthropic/dll.) tetap berjalan hingga tuntas atau timeout 55 detik. Morphic tetap ditagih penuh oleh penyedia hulu untuk token yang tidak pernah diterima oleh pengguna.
  2. **Inkonsistensi Saldo:** Di `v1.ts:434-457`, disconnect klien pada streaming SSE dianggap error dan sisa estimasi kredit dikembalikan, namun penyedia hulu telah memproses request secara penuh.
- **Mitigasi Cepat:**
  Gunakan `AbortSignal.any()` untuk menggabungkan timeout signal dengan abort signal klien di `router.ts`:
  ```typescript
  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const combinedSignal = req.signal
    ? AbortSignal.any([req.signal, timeoutSignal])
    : timeoutSignal;

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: combinedSignal,
  });
  ```

---

### 🟠 TINGGI — T-B3-02: Tidak Ada Runtime Failover Saat Panggilan Primer Gagal & Ketiadaan Pool Key Hulu
- **ID PRD Terkait:** FR-GW-04, FR-GW-05, PROXY-06, PROXY-10, OPS-ALT-04
- **Butir Audit:** PROXY-06 (Circuit Breaker & Fallback), PROXY-10 (Upstream Key Pool)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/routes/v1.ts:278-321`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\v1.ts#L278-L321):
  ```typescript
  try {
    upstream = await callProvider({ ... });
  } catch (e: any) {
    const isTimeout = e?.name === 'TimeoutError' || String(e).includes('timeout');
    const norm = normalizeUpstreamError(isTimeout ? 'timeout' : 'network');
    if (norm.countAsFailure) {
      await recordFailure(route.providerId);
    }
    const settleRes = await settle({ ... status: 'error' });
    // LANGSUNG RETURN ERROR KE KLIEN — TIDAK PERNAH MENCOBA FALLBACK PROVIDER!
    return c.json({ error: { message: 'upstream provider unreachable', type: norm.type, code: norm.code } }, norm.httpStatus);
  }
  ```
  [`apps/api/src/domain/router.ts:121-126`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\domain\router.ts#L121-L126):
  ```typescript
  // Fallback hanya dicek SEBELUM request jika circuit breaker SUDAH open sebelumnya:
  if (row.providerStatus === 'active' && !(await isCircuitOpen(row.providerId))) {
    return buildRoute(row, { isUsingFallback: false, ... });
  }
  ```
- **Dampak Keamanan & Bisnis:**
  1. Jika provider primer mengalami transient network error atau HTTP 500/502/503 saat request berlangsung, request pengguna langsung gagal seketika meskipun `fallbackProviderId` telah dikonfigurasi di database.
  2. Ketiadaan pool key hulu (setiap provider hanya memiliki 1 baris credential di tabel `providers`) menyebabkan single point of failure jika akun/key hulu tersebut terkena rate limit kuota hulu.
- **Mitigasi Cepat:**
  Bungkus pemanggilan upstream dalam loop failover: jika provider primer melempar error jaringan/timeout atau status 502/503, dan model memiliki `fallbackProviderId`, catat failure pada primer lalu coba dispatch request ke provider fallback sebelum mengembalikan error ke klien.

---

### 🟡 SEDANG — T-B3-03: Ketiadaan Pembatasan Ukuran Body Request (Body Limit Middleware)
- **ID PRD Terkait:** FR-GW-06, PROXY-04, INJ-01
- **Butir Audit:** PROXY-04 (Request Body Size Limiting)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/routes/v1.ts:100-103`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\v1.ts#L100-L103):
  ```typescript
  let parsed: ReturnType<typeof chatCompletionRequestSchema.safeParse>;
  try {
    parsed = chatCompletionRequestSchema.safeParse(await c.req.json());
  } catch { ... }
  ```
- **Dampak Keamanan & Bisnis:**
  Penyerang dengan API key valid dapat mengirimkan body JSON berukuran puluhan atau ratusan megabyte dalam satu request. V8 engine Node.js akan mengalokasikan buffer raksasa untuk mem-parse JSON, memicu lonjakan konsumsi RAM dan potensi crash denial-of-service (OOM - Out of Memory, CWE-400).
- **Mitigasi Cepat:**
  Pasang middleware `bodyLimit` bawaan Hono pada router `/v1/chat/*` di `v1.ts`:
  ```typescript
  import { bodyLimit } from 'hono/body-limit';
  v1.use('/chat/*', bodyLimit({ maxSize: 4 * 1024 * 1024 })); // Batas aman 4 MB
  ```

---

### 🟡 SEDANG — T-B3-04: State Circuit Breaker Disimpan di PostgreSQL per Request
- **ID PRD Terkait:** FR-GW-05, OPS-SLO-01, NFR-01, NFR-05
- **Butir Audit:** PROXY-06 (Circuit Breaker Architecture)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/domain/circuit-breaker.ts:24-37, 107-115`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\domain\circuit-breaker.ts#L24-L37):
  ```typescript
  export async function getCircuitState(providerId: string): Promise<CircuitBreakerState> {
    const [row] = await db.select({ circuitBreakerState: s.providers.circuitBreakerState })
      .from(s.providers).where(eq(s.providers.id, providerId)).limit(1);
    return row?.circuitBreakerState ?? DEFAULT_STATE;
  }

  async function updateCircuitState(providerId: string, state: CircuitBreakerState): Promise<void> {
    await db.update(s.providers).set({ circuitBreakerState: state }).where(eq(s.providers.id, providerId));
  }
  ```
- **Dampak Keamanan & Bisnis:**
  Setiap request chat completion melakukan query SQL `SELECT` ke tabel `providers` untuk memeriksa status circuit breaker, dan melakukan query `UPDATE` ke tabel `providers` setiap kali terjadi kegagalan atau pemulihan (`recordSuccess` di `v1.ts:376`). Pada beban trafik tinggi, pembaruan baris DB relasional untuk state operasional ephemeral ini membebani connection pool PostgreSQL dan dapat melanggar SLO overhead gateway (p95 ≤ 50 ms).
- **Mitigasi Cepat:**
  Pindahkan penyimpanan state circuit breaker ke Redis (menggunakan hash key `cb:provider:<id>`) atau cache in-memory lokal dengan periodic refresh, serupa dengan arsitektur `rateLimitStore` di `ratelimit.ts`.

---

### 🟡 SEDANG — T-B3-05: Estimasi Token Streaming SSE Menggunakan Heuristik Kasar (`chunksReceived * 8`)
- **ID PRD Terkait:** FR-GW-01, FR-GW-07, PROXY-13, POL-PRIC-03
- **Butir Audit:** PROXY-13 (Token Metering & Streaming Accuracy)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/routes/v1.ts:439-445`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\v1.ts#L439-L445):
  ```typescript
  const promptT = usage?.prompt_tokens ?? promptTokens;
  const completionT =
    usage?.completion_tokens ??
    (lastKnownCompletionTokens > 0
      ? lastKnownCompletionTokens
      : chunksReceived > 0
        ? Math.max(1, chunksReceived * 8)
        : 0);
  ```
- **Dampak Keamanan & Bisnis:**
  Banyak upstream OpenAI-compatible tidak menyertakan objek `usage` dalam chunk SSE secara default kecuali request secara eksplisit menyertakan `stream_options: { include_usage: true }`. Jika provider tidak mengirimkan `usage`, Morphic mengalikan jumlah chunk dengan 8 token. Ini adalah estimasi arbitrer yang dapat menghasilkan selisih penagihan kredit drastis (overcharge atau undercharge terhadap pelanggan), melanggar SLO akurasi billing (< 0,1% deviasi, OPS-SLO-03).
- **Mitigasi Cepat:**
  1. Di `OpenAiCompatibleAdapter.dispatchRequest` (`router.ts:175`), suntikkan parameter `stream_options: { include_usage: true }` secara otomatis ke body request streaming.
  2. Kumpulkan akumulasi teks output dari chunk SSE (`delta.content`) dan jalankan fungsi estimasi token berbasis karakter (`Math.ceil(accumulatedText.length / 4)`) sebagai fallback alih-alih mengalikan chunk count dengan 8.

---

### 🟡 SEDANG — T-B3-06: Format Respons Error Tidak Memuat `request_id` di JSON Body & Header Response
- **ID PRD Terkait:** FR-GW-08, FR-GW-09, API-ERR-SCHEME, API-GW-RESPHDR
- **Butir Audit:** PROXY-07 (Error Normalization Scheme)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/routes/v1.ts:143-152`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\v1.ts#L143-L152):
  ```typescript
  return c.json(
    {
      error: {
        message: 'invalid request body',
        type: 'invalid_request_error',
        code: 'invalid_request_body',
        details: parsed.error.issues, // <-- request_id TIDAK ADA di objek error
      },
    },
    400,
  );
  ```
  [`apps/api/src/routes/v1.ts:95`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\v1.ts#L95):
  `const requestId = randomUUID();` dibuat dan dicatat ke log, namun tidak pernah di-set ke header respons klien (`c.header('X-Request-Id', requestId)` tidak ada).
- **Dampak Keamanan & Bisnis:**
  Pengguna dan pengembang SDK tidak menerima ID pelacakan request saat terjadi kegagalan request. Investigasi keluhan pelanggan pada audit trail menjadi lambat karena tidak ada korelasi ID antara pesan error di sisi klien dengan `request_logs` di database.
- **Mitigasi Cepat:**
  1. Pasang middleware global di `v1.ts` untuk meng-inject `c.header('X-Request-Id', requestId)`.
  2. Sertakan field `request_id: requestId` di dalam seluruh payload respons JSON error di `v1.ts`.

---

### 🔵 RENDAH — T-B3-07: Endpoint `/v1/models` Tidak Membatasi Model Berdasarkan Hak Akses Key
- **ID PRD Terkait:** FR-GW-02, DM-ENT-10
- **Butir Audit:** PROXY-03 (Model Catalog Scope)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:**
  [`apps/api/src/routes/v1.ts:23-34`](file:///c:/Users/esc\Desktop\morphic\apps\api\src\routes\v1.ts#L23-L34):
  `db.select().from(s.models).where(inArray(s.models.status, ['active', 'deprecated']))` dieksekusi tanpa memeriksa tier, organisasi, atau scope API key.
- **Dampak Keamanan & Bisnis:**
  Pengguna dengan tier gratis atau key dengan scope terbatas dapat melihat seluruh inventaris model enterprise/premium.
- **Mitigasi Cepat:**
  Tambahkan filtering model berdasarkan scope key pengguna atau tier akun pada query model catalog.

---

### 🔵 RENDAH — T-B3-08: Endpoint Embeddings Belum Diimplementasikan (Fase 2)
- **ID PRD Terkait:** FR-GW-03, API-GW-03
- **Butir Audit:** API-GW-03 (Embeddings Route)
- **Keyakinan:** Confirmed (Terverifikasi di Kode Sumber)
- **Bukti Kode:** `apps/api/src/routes/v1.ts` tidak memiliki route handler untuk `POST /v1/embeddings`.
- **Dampak Keamanan & Bisnis:** Klien yang menggunakan SDK untuk kebutuhan vector embedding akan menerima error 404 Not Found.
- **Mitigasi Cepat:** Tambahkan handler endpoint embeddings pada rilis Fase 2 sesuai jadwal roadmap PRD.

---

## 4. Analisis Mendalam atas 6 Pertanyaan Kunci Gateway Conformance

### 1. Kompatibilitas OpenAI API & SDK (Chat Completions & Streaming SSE)
- Endpoint `POST /v1/chat/completions` kompatibel dengan format OpenAI v1 API. Permintaan JSON dipetakan dengan tepat ke provider hulu.
- Streaming SSE diimplementasikan menggunakan streaming native Hono (`streamSSE`) dengan parsing per baris (`data: {...}`).
- **Temuan Kritis:** Tidak adanya injeksi otomatis `stream_options: { include_usage: true }` ke upstream mengakibatkan hilangnya objek token usage pada chunk terakhir di banyak provider, memicu fallback ke tebakan kasar token (T-B3-05).

### 2. Mekanisme Routing, Provider Fallback, dan Circuit Breaker
- Model resolution (`resolveModelWithFallback` di `router.ts:101`) mendukung alias publik, pemetaan nama model hulu, penanganan model deprecated, dan pengecekan primary vs fallback provider.
- Namun mekanisme circuit breaker memiliki dua kelemahan mendasar:
  1. Bersifat **statik pra-request**: Jika provider primer sehat saat rute dibentuk tetapi gagal saat koneksi HTTP berlangsung, gateway tidak melakukan failover ke provider cadangan (T-B3-02).
  2. State circuit breaker disimpan langsung ke kolom tabel database PostgreSQL per-request, bukan di memori/Redis (T-B3-04).

### 3. Ketahanan Pembatalan Upstream saat Klien Disconnect (Client Abort Signal)
- Hono menyediakan `c.req.raw.signal` yang aktif saat koneksi HTTP klien terputus. Parameter ini diteruskan ke `callProvider` di `v1.ts:276`.
- Namun di dalam `OpenAiCompatibleAdapter.dispatchRequest` (`router.ts:180-186`), signal klien **ditinggalkan** dan digantikan oleh `timeoutSignal`. Akibatnya, koneksi ke provider hulu tidak dibatalkan saat klien putus koneksi (T-B3-01).

### 4. Integritas Metering, Estimasi Token, dan Siklus Reserve/Settle Saldo
- Siklus reservasi saldo (`reserve` di `billing.ts:112`) dan penyelesaian tagihan (`settle` di `billing.ts:189`) berjalan secara transaksional ACID di PostgreSQL (`withTransaction`).
- Nilai token masukan diestimasi via `estimatePromptTokens` (`Math.ceil(text.length / 4)`).
- Biaya actual dikonversi menjadi kredit melalui `tokensToCredits` (`(tokens * creditsPer1m) / 1_000_000`).
- Mekanisme settlement mengunci row reservasi (`FOR UPDATE`) dan menjamin saldo pengguna tidak pernah ditagih melebihi estimasi batas atas reservasi (`Math.min(actualCredits, estimatedCredits)`).

### 5. Zero-Retention Prompt/Response Policy & Sanitasi Log
- Sistem memenuhi prinsip **Zero Data Retention** secara sempurna (FR-GW-11, PROXY-01, AI-02).
- Baik tabel `request_logs` maupun `usage_records` tidak memiliki kolom untuk menyimpan konten prompt maupun hasil completion.
- Logger hanya mencatat ID metadata numerik (token, latency, model ID, error code).

### 6. Skema Error, Pencegahan Kebocoran Sensitif, dan Header Standar
- Format error meniru skema OpenAI (`{ error: { message, type, code } }`) dan berhasil menyembunyikan stack trace internal atau detail implementasi server.
- **Kekurangan:** Field `request_id` di dalam JSON error tidak ada (T-B3-06), dan header wajib gateway (`X-Request-Id`, `Retry-After`, `X-RateLimit-*`) tidak pernah disuntikkan ke respons HTTP (FR-GW-09 / T-B2-06).

---

## 5. Rekapitulasi Status & Matriks Risiko

### 5.1 Ringkasan Status Kebutuhan FR-GW (12 Butir)
| Status | Jumlah | Persentase | Rincian Butir |
|---|---|---|---|
| **IMPLEMENTED** | 3 | 25.0% | FR-GW-07, FR-GW-11, FR-GW-12 |
| **PARTIAL** | 6 | 50.0% | FR-GW-01, FR-GW-02, FR-GW-04, FR-GW-05, FR-GW-06, FR-GW-08 |
| **FAILED / VIOLATION** | 2 | 16.7% | FR-GW-09, FR-GW-10 |
| **MISSING** | 1 | 8.3% | FR-GW-03 (Fase 2) |
| **TOTAL** | **12** | **100%** | |

### 5.2 Matriks Temuan Berdasarkan Keparahan
| Tingkat Keparahan | Jumlah | Kode Temuan |
|---|---|---|
| 🔴 **Kritis** | 0 | — |
| 🟠 **Tinggi** | 2 | T-B3-01, T-B3-02 |
| 🟡 **Sedang** | 4 | T-B3-03, T-B3-04, T-B3-05, T-B3-06 |
| 🔵 **Rendah** | 2 | T-B3-07, T-B3-08 |
| **TOTAL TEMUAN** | **8** | |

### 5.3 Prioritas Tindakan Perbaikan
1. **P0 (Mendesak / Biaya Operasional):**
   - Perbaiki `OpenAiCompatibleAdapter` untuk menyatukan client abort signal (`c.req.raw.signal`) dengan timeout signal menggunakan `AbortSignal.any()` (T-B3-01).
   - Suntikkan `stream_options: { include_usage: true }` ke upstream request streaming untuk mencegah pembengkakan estimasi token arbitrer (T-B3-05).
2. **P1 (Stabilitas & Ketahanan Layanan):**
   - Pasang middleware pembatas ukuran body request `bodyLimit` di Hono (T-B3-03).
   - Implementasikan runtime fallback saat eksekusi provider primer gagal (T-B3-02).
   - Pindahkan state circuit breaker dari PostgreSQL ke Redis/In-memory (T-B3-04).
3. **P2 (Kepatuhan Spesifikasi API):**
   - Sertakan `request_id` di JSON error dan header `X-Request-Id` serta header `Retry-After` saat rate limit 429 (T-B3-06, FR-GW-09).
   - Filter daftar `/v1/models` berdasarkan hak akses key pemanggil (T-B3-07).

---

## 6. Informasi Wajib Penutup B3 & Update Handoff

### 6.1 File yang Sudah Dibaca Lengkap
1. `apps/api/src/routes/v1.ts` (521 baris)
2. `apps/api/src/domain/router.ts` (256 baris)
3. `apps/api/src/domain/circuit-breaker.ts` (116 baris)
4. `apps/api/src/ratelimit.ts` (152 baris)
5. `apps/api/src/middleware/auth.ts` (107 baris)
6. `apps/api/src/middleware/logger.ts` (28 baris)
7. `packages/db/src/billing.ts` (531 baris)
8. `packages/shared/src/credits.ts` (49 baris)
9. `packages/shared/src/types.ts` (26 baris)
10. `packages/db/src/schema.ts` (401 baris)

### 6.2 Hal yang Butuh Uji Manual di Staging
1. Uji aborting koneksi klien pada request streaming berdurasi panjang dan verifikasi apakah koneksi hulu ke OpenAI langsung berhenti di dashboard penyedia hulu.
2. Uji simulasi kegagalan provider primer (injeksi status 502) dan pastikan apakah sistem dapat melakukan automatic failover ke provider cadangan tanpa downtime klien.
3. Benchmarking latensi gateway p95 saat database PostgreSQL mengalami beban tinggi.
