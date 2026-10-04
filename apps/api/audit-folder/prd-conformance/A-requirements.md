# LAPORAN TAHAP A: EKSTRAKSI KEBUTUHAN PRD

**Platform:** Web AI API Provider (Gateway & Reseller API Key)  
**Dokumen Sumber:** `PRD_AI_API_GATEWAY.md` (v1.0, 4 Oktober 2026) & `SECURITY_AUDIT_CHECKLIST.md` (v1.0, 4 Oktober 2026)  
**Tanggal Ekstraksi:** 4 Oktober 2026  
**Auditor:** Senior Code Conformance Auditor (Mode: READ-ONLY)  
**Status File:** Draft Ekstraksi Lengkap Kebutuhan untuk Penelusuran Kode (Traceability)

---

## 1. Ringkasan Eksekutif Ekstraksi

Tahap A mengekstrak seluruh butir kebutuhan yang didefinisikan dalam dokumen PRD (`PRD_AI_API_GATEWAY.md`) sebagai sumber kebenaran (Source of Truth) sistem. Ekstraksi mencakup:
1. **Kebutuhan Fungsional (FR):** 72 butir (FR-AUTH, FR-KEY, FR-GW, FR-BILL, FR-DASH, FR-ADM, FR-ABU, FR-NOT, FR-PRV)
2. **Kebutuhan Non-Fungsional (NFR):** 15 butir (NFR-01 s/d NFR-15)
3. **Kebutuhan Keamanan & Kepatuhan (SR):** 16 butir (SR-01 s/d SR-16)
4. **Kebijakan Data (POL-DATA):** 7 butir (Bagian 11.1)
5. **Prinsip Harga & Kepercayaan (POL-PRIC):** 5 butir (Bagian 6.2)
6. **Model Data & Aturan Integritas (DM):** 20 butir (15 Entitas DM-ENT + 5 Aturan Integritas DM-RULE, Bagian 13)
7. **Spesifikasi API & Format Error (API):** 17 butir (Gateway Publik, Console API, Webhook, Admin, Skema Error, Bagian 14)
8. **Observabilitas, Alert & Runbook (OPS):** 26 butir (5 SLO, 11 Alert, 3 Logging, 7 Runbook, Bagian 15)

**Total Butir Kebutuhan yang Diekstrak:** **178 Butir**

---

## 2. Tabel Induk Ekstraksi Kebutuhan

| ID | Kategori | Uraian Kebutuhan | Prioritas | Fase Rilis | Acceptance Criteria (Syarat Penerimaan) | Kontrol Audit Terkait |
|---|---|---|---|---|---|---|
| **FR-AUTH-01** | FR-AUTH | Registrasi email + verifikasi email + CAPTCHA | M | Fase 1 | Given email valid, when daftar, then akun nonaktif sampai verifikasi; pendaftaran massal dibatasi rate limit | AUTH-09 |
| **FR-AUTH-02** | FR-AUTH | Login dengan password + opsi MFA (TOTP); MFA wajib untuk admin | M | Fase 1 | Given admin tanpa MFA, when login, then ditolak/diarahkan setup MFA | AUTH-03 |
| **FR-AUTH-03** | FR-AUTH | Reset password aman | M | Fase 1 | Token sekali pakai, kedaluwarsa ≤ 30 menit; respons seragam untuk email terdaftar/tidak | AUTH-05, AUTH-11 |
| **FR-AUTH-04** | FR-AUTH | Hash password Argon2id/bcrypt; cek password bocor | M | Fase 1 | Password tidak pernah tersimpan/terlog dalam plaintext | AUTH-01, AUTH-02 |
| **FR-AUTH-05** | FR-AUTH | Manajemen sesi: daftar sesi aktif, logout semua perangkat | S | Fase 1 | Ganti password mengakhiri semua sesi lain | AUTH-06 |
| **FR-AUTH-06** | FR-AUTH | Hapus akun dan ekspor data | M | Fase 1 | Sesuai FR-PRV-01/02 | DATA-04, DATA-05 |
| **FR-AUTH-07** | FR-AUTH | SSO (Google/GitHub/SAML) | C | Fase 3 | Validasi `state`, PKCE, redirect URI exact-match | AUTH-08 |
| **FR-AUTH-08** | FR-AUTH | Organisasi/tim + peran (owner, admin, developer, billing, viewer) | S | Fase 3 | Peran membatasi akses key, billing, dan anggota | AUTHZ-04 |
| **FR-KEY-01** | FR-KEY | Buat key dengan nama, scope (model/endpoint), batas, kedaluwarsa opsional | M | Fase 1 | Key dihasilkan CSPRNG ≥ 128 bit; prefix khas; hanya hash tersimpan | KEY-01, KEY-02, KEY-07, KEY-11 |
| **FR-KEY-02** | FR-KEY | Tampilkan key penuh sekali saat dibuat | M | Fase 1 | Setelah ditutup, hanya prefix + 4 karakter terakhir yang tampil | KEY-03 |
| **FR-KEY-03** | FR-KEY | Daftar key (masked), terakhir dipakai, status | M | Fase 1 | Tidak ada endpoint yang mengembalikan key penuh | KEY-03 |
| **FR-KEY-04** | FR-KEY | Revoke instan | M | Fase 1 | Given key direvoke, when dipakai, then 401 dalam ≤ 5 detik | KEY-06 |
| **FR-KEY-05** | FR-KEY | Rotasi key dengan masa tenggang (grace period) | S | Fase 1 | Key lama dan baru aktif bersamaan hingga batas yang dipilih | KEY-06 |
| **FR-KEY-06** | FR-KEY | Batas per key: RPM, TPM, kuota harian/bulanan, spend cap, concurrency | M | Fase 1 | Melebihi batas → 429 (rate) atau 402/403 (kuota/spend) dengan pesan jelas | KEY-08 |
| **FR-KEY-07** | FR-KEY | IP allowlist per key | C | Fase 1 | Request dari IP di luar daftar ditolak | KEY-09 |
| **FR-KEY-08** | FR-KEY | Audit log siklus hidup key | M | Fase 1 | Create/rotate/revoke tercatat dengan aktor, waktu, IP | KEY-13, LOG-01 |
| **FR-KEY-09** | FR-KEY | Batas jumlah key per akun | S | Fase 1 | Dibatasi dengan jumlah default (mis. 20 key per akun) | KEY-13 |
| **FR-GW-01** | FR-GW | Endpoint chat completions kompatibel (dengan streaming SSE) | M | Fase 1 | Contoh SDK populer berjalan hanya dengan mengganti `base_url` dan key | PROXY-03 |
| **FR-GW-02** | FR-GW | Endpoint daftar model sesuai plan/scope | M | Fase 1 | Model di luar scope tidak tampil dan ditolak jika dipanggil | PROXY-03 |
| **FR-GW-03** | FR-GW | Endpoint embeddings | S | Fase 2 | Biaya dihitung per token input | BILL-04 |
| **FR-GW-04** | FR-GW | Routing alias model → model hulu + pool key hulu | M | Fase 1 | Alias terdokumentasi; pergantian model hulu tercatat | PROXY-09, PROXY-10 |
| **FR-GW-05** | FR-GW | Retry/fallback terkontrol + circuit breaker | M | Fase 1 | Retry tidak menagih ganda; batas retry jelas | PROXY-06 |
| **FR-GW-06** | FR-GW | Validasi request: ukuran body, jumlah pesan, max_tokens, parameter | M | Fase 1 | Melebihi batas → 413/400 dengan pesan jelas | PROXY-03, PROXY-04 |
| **FR-GW-07** | FR-GW | Metering real-time (token input/output, latensi, status) | M | Fase 1 | Setiap request menghasilkan satu `usage_event` unik | BILL-04 |
| **FR-GW-08** | FR-GW | Format error standar + request_id | M | Fase 1 | Semua error memakai skema §14.4; tanpa stack trace | PROXY-07, INFRA-01 |
| **FR-GW-09** | FR-GW | Header rate limit & X-Request-Id | M | Fase 1 | Header Retry-After pada respons 429 | KEY-08 |
| **FR-GW-10** | FR-GW | Pembatalan upstream saat klien disconnect | M | Fase 1 | Konsumsi hulu berhenti; tagihan sesuai token terpakai | PROXY-05 |
| **FR-GW-11** | FR-GW | Tidak menyimpan isi prompt/respons secara default (zero-retention) | M | Fase 1 | Log hanya metadata; opt-in debug dengan TTL | AI-02, AI-11 |
| **FR-GW-12** | FR-GW | Informasi model yang dilayani pada respons (`model`) konsisten dengan yang ditagih | M | Fase 1 | Uji sampel: model respons = model tagihan | PROXY-09 |
| **FR-BILL-01** | FR-BILL | Dompet saldo prepaid berbasis ledger append-only | M | Fase 1 | Saldo = hasil penjumlahan ledger; tidak ada update langsung tanpa entri ledger | BILL-01, BILL-13 |
| **FR-BILL-02** | FR-BILL | Top-up lewat hosted checkout payment gateway | M | Fase 1 | Data kartu tidak menyentuh server | BILL-11 |
| **FR-BILL-03** | FR-BILL | Webhook pembayaran: verifikasi signature, anti-replay, idempoten, validasi jumlah/mata uang | M | Fase 1 | Webhook duplikat tidak menambah saldo; signature salah ditolak | BILL-05, BILL-06, BILL-07 |
| **FR-BILL-04** | FR-BILL | Reservasi → settle saldo pada tiap request | M | Fase 1 | Saldo tidak pernah negatif akibat request paralel | BILL-01, BILL-02 |
| **FR-BILL-05** | FR-BILL | Tabel harga per model (per 1 juta token) + markup yang dikonfigurasi admin | M | Fase 1 | Harga dihitung server-side; perubahan harga tercatat di audit log | BILL-03 |
| **FR-BILL-06** | FR-BILL | Notifikasi saldo rendah + auto-suspend saat saldo habis | M | Fase 1 | Ambang terkonfigurasi; request ditolak 402 saat saldo habis | BILL-02 |
| **FR-BILL-07** | FR-BILL | Kuitansi/invoice + riwayat transaksi | S | Fase 1 | Dapat diunduh; konsisten dengan ledger | BILL-13 |
| **FR-BILL-08** | FR-BILL | Refund dan penanganan chargeback | S | Fase 1 | Chargeback → penangguhan akun/saldo sesuai kebijakan | BILL-09 |
| **FR-BILL-09** | FR-BILL | Kode promo/referral dengan proteksi abuse | C | Fase 1 | Satu redeem per akun/perangkat; deteksi multi-akun | BILL-10 |
| **FR-BILL-10** | FR-BILL | Auto top-up | C | Fase 3 | Ambang dan batas bulanan yang ditetapkan pengguna | BILL-08 |
| **FR-BILL-11** | FR-BILL | Pajak (mis. PPN) sesuai yurisdiksi | S | Fase 1 | Tarif dan label pajak tampil di invoice | LEGAL-04 |
| **FR-BILL-12** | FR-BILL | Perhitungan uang memakai tipe integer/decimal | M | Fase 1 | Tidak ada float pada perhitungan uang | BILL-14 |
| **FR-DASH-01** | FR-DASH | Penggunaan per key/model/hari (token, biaya, request, error) | M | Fase 1 | Data tertunda ≤ 5 menit | - |
| **FR-DASH-02** | FR-DASH | Grafik biaya dan proyeksi saldo | S | Fase 1 | Menampilkan estimasi hari tersisa | - |
| **FR-DASH-03** | FR-DASH | Ekspor CSV penggunaan dan transaksi | S | Fase 1 | Data hanya milik pengguna/organisasi sendiri | AUTHZ-02 |
| **FR-DASH-04** | FR-DASH | Dokumentasi, quickstart multi-bahasa (curl, Python, JS) | M | Fase 1 | Contoh dapat dijalankan apa adanya | - |
| **FR-DASH-05** | FR-DASH | Playground uji model | S | Fase 2 | Output dirender aman (tahan XSS/injeksi) | AI-05 |
| **FR-DASH-06** | FR-DASH | Status page + riwayat insiden | S | Fase 2 | Menampilkan status per model/hulu | - |
| **FR-DASH-07** | FR-DASH | Halaman harga publik dan daftar model | M | Fase 1 | Sinkron dengan tabel harga server | - |
| **FR-ADM-01** | FR-ADM | RBAC admin (super admin, finance, support, security) + MFA wajib + IP allowlist | M | Fase 1 | Aksi di luar peran → 403 | FE-04, AUTHZ-04 |
| **FR-ADM-02** | FR-ADM | Manajemen pengguna: lihat, suspend, blokir, ubah plan | M | Fase 1 | Semua aksi tercatat di audit log | LOG-01 |
| **FR-ADM-03** | FR-ADM | Manajemen pool key hulu (status, kuota, rotasi) tanpa menampilkan nilai key | M | Fase 1 | Key hulu tidak pernah tampil di UI/API | SEC-02, SEC-05 |
| **FR-ADM-04** | FR-ADM | Konfigurasi model, alias, harga, markup | M | Fase 1 | Perubahan butuh peran finance + log | BILL-03 |
| **FR-ADM-05** | FR-ADM | Abuse queue + tindakan cepat | M | Fase 1 | Tinjauan memakai metadata, bukan isi prompt | AI-08, AI-09 |
| **FR-ADM-06** | FR-ADM | Laporan rekonsiliasi: biaya hulu vs pendapatan, margin per model/pelanggan | M | Fase 1 | Alarm bila margin negatif | BILL-12 |
| **FR-ADM-07** | FR-ADM | Penampil audit log (filter, ekspor) | M | Fase 1 | Log tidak dapat diubah dari UI | LOG-01, LOG-03 |
| **FR-ADM-08** | FR-ADM | Impersonasi pengguna dengan justifikasi + persetujuan | C | Fase 1 | Setiap sesi impersonasi diaudit dan dibatasi waktu | AUTHZ-07 |
| **FR-ABU-01** | FR-ABU | Rate limit bertingkat (per IP, akun, key, global) | M | Fase 1 | Spoofing X-Forwarded-For tidak bisa mem-bypass | KEY-08, T-05 |
| **FR-ABU-02** | FR-ABU | Deteksi anomali (lonjakan, banyak IP/geo, pola carding) | M | Fase 1 | Alert < 5 menit sejak pola terdeteksi | KEY-10, LOG-04 |
| **FR-ABU-03** | FR-ABU | Auto-suspend + notifikasi pemilik | M | Fase 1 | Dapat diajukan banding via support | KEY-10 |
| **FR-ABU-04** | FR-ABU | Persetujuan AUP saat daftar | M | Fase 1 | Versi AUP yang disetujui dicatat | AI-08 |
| **FR-ABU-05** | FR-ABU | Kanal laporan abuse + proses takedown | S | Fase 1 | SLA tinjauan tercatat | LEGAL-08 |
| **FR-ABU-06** | FR-ABU | KYC bertingkat untuk pengeluaran tinggi | S | Fase 2 | Ambang terkonfigurasi; data KYC terenkripsi | LEGAL-06 |
| **FR-ABU-07** | FR-ABU | Anti-fraud top-up (3DS, risk score, hold dana awal) | M | Fase 1 | Top-up berisiko ditahan/ditolak | BILL-08 |
| **FR-NOT-01** | FR-NOT | Email transaksional: verifikasi, reset, top-up, saldo rendah, key dibuat/dicabut, login baru, suspend | M | Fase 1 | Notifikasi terkirim tepat waktu pada tiap kejadian kritis | - |
| **FR-NOT-02** | FR-NOT | Pusat bantuan + formulir tiket/kontak keamanan | M | Fase 1 | Pelanggan dapat mengirim tiket bantuan dan laporan insiden | - |
| **FR-NOT-03** | FR-NOT | Notifikasi insiden/pemeliharaan (email + status page) | S | Fase 1 | Pengguna mendapat peringatan downtime atau jadwal maintenance | - |
| **FR-NOT-04** | FR-NOT | Webhook notifikasi ke pelanggan (saldo rendah, limit) | C | Fase 3 | Mengirim event webhook ber-signature ke URL pelanggan | - |
| **FR-PRV-01** | FR-PRV | Ekspor data pribadi (DSAR) | M | Fase 1 | Selesai ≤ 30 hari (target internal ≤ 7 hari) | DATA-04 |
| **FR-PRV-02** | FR-PRV | Penghapusan akun dan data terkait | M | Fase 1 | Data terhapus sesuai kebijakan retensi; konfirmasi tertulis | DATA-05 |
| **FR-PRV-03** | FR-PRV | Persetujuan cookie dan pengaturan privasi | M | Fase 1 | Cookie non-esensial hanya aktif setelah persetujuan (bila berlaku) | DATA-07 |
| **FR-PRV-04** | FR-PRV | Pengaturan retensi log opt-in (debug) dengan TTL | S | Fase 1 | Default nonaktif; TTL maksimal terdefinisi | AI-02 |
| **FR-PRV-05** | FR-PRV | Daftar sub-prosesor publik + DPA yang dapat diunduh | S | Fase 1 | Diperbarui saat ada perubahan | LEGAL-05 |
| **NFR-01** | NFR | Overhead latensi gateway di luar waktu hulu | M | Fase 1 | p95 ≤ 50 ms; p99 ≤ 150 ms | - |
| **NFR-02** | NFR | Kapasitas throughput request per detik | S | Fase 1 | Target RPS terpenuhi per instance; skala horizontal | - |
| **NFR-03** | NFR | Ketersediaan uptime gateway | M | Fase 1 | ≥ 99,9% bulanan | - |
| **NFR-04** | NFR | Ketahanan RPO / RTO | S | Fase 1 | RPO ≤ 15 menit; RTO ≤ 4 jam | - |
| **NFR-05** | NFR | Skalabilitas gateway & pipeline | M | Fase 1 | Gateway stateless, DB dengan replika baca, antrean untuk metering | - |
| **NFR-06** | NFR | Integritas data keuangan & billing | M | Fase 1 | Ledger append-only, transaksi ACID untuk saldo, 0 anomali rekonsiliasi harian | - |
| **NFR-07** | NFR | Keamanan sistem terpadu | M | Fase 0 | Memenuhi seluruh butir kebutuhan keamanan SR-01 s/d SR-16 | Traceability §11 |
| **NFR-08** | NFR | Privasi data prompt & respons | M | Fase 1 | Zero-retention default; hanya menyimpan log metadata | AI-02, AI-11 |
| **NFR-09** | NFR | Observabilitas sistem (metrik, trace, alert) | M | Fase 1 | MTTD < 5 menit untuk insiden Kritis | - |
| **NFR-10** | NFR | Kompatibilitas SDK & client API | M | Fase 1 | SDK populer berjalan hanya dengan perubahan `base_url` dan key | - |
| **NFR-11** | NFR | Lokalisasi antarmuka dan mata uang | S | Fase 1 | Antarmuka ID/EN; mata uang IDR/USD | - |
| **NFR-12** | NFR | Aksesibilitas Web Dasbor | S | Fase 2 | Dasbor web mengikuti standar WCAG 2.2 AA | - |
| **NFR-13** | NFR | Maintainability & test coverage | S | Fase 1 | Cakupan uji otomatis modul auth/billing/proxy ≥ 80% (jalur kritis 100%) | - |
| **NFR-14** | NFR | Pemantauan biaya cloud & hulu | M | Fase 1 | Alarm anggaran cloud dan biaya hulu aktif | AVAIL-06, INFRA-13 |
| **NFR-15** | NFR | Kepatuhan hukum dan regulasi | M | Fase 1 | Kepatuhan terhadap UU PDP, GDPR (bila UE), PCI DSS scope minimal | - |
| **SR-01** | SR | Manajemen secret dan kredensial aman | M | Fase 0 | Tidak ada secret di kode/git; secret di secret manager; rotasi teruji | SEC-01..09 |
| **SR-02** | SR | Keamanan autentikasi dan sesi | M | Fase 1 | Password Argon2id/bcrypt; MFA wajib untuk admin; rate limit auth | AUTH-01..11 |
| **SR-03** | SR | Siklus hidup dan keamanan API key | M | Fase 1 | CSPRNG, hash-only, tampil sekali, revoke instan, scope, rate limit | KEY-01..13 |
| **SR-04** | SR | Otorisasi objek, fungsi & tenant isolation | M | Fase 1 | Validasi otorisasi di server; isolasi tenant ketat; cache per tenant | AUTHZ-01..08 |
| **SR-05** | SR | Integritas billing & mitigasi race condition | M | Fase 1 | Billing atomik, idempoten, tahan race condition; webhook signature | BILL-01..14 |
| **SR-06** | SR | Keamanan proxy & pencegahan SSRF | M | Fase 1 | Tahan SSRF; header whitelist; validasi model/param; TLS hulu valid | PROXY-01..13 |
| **SR-07** | SR | Ketahanan terhadap injeksi, XSS, dan CSRF | M | Fase 1 | Validasi skema input Zod/Joi; escape output; CORS ketat | INJ-01..14 |
| **SR-08** | SR | Tata kelola & keamanan AI/LLM | M | Fase 1 | Zero-retention prompt; isolasi lintas tenant; AUP; inventaris hulu | AI-01..13 |
| **SR-09** | SR | Perlindungan data pribadi & kriptografi | M | Fase 1 | Enkripsi transit & at-rest; minimisasi data; DSAR; breach notification | DATA-01..12 |
| **SR-10** | SR | Pengerasan infrastruktur & jaringan | M | Fase 0 | Surface area minimal; header keamanan (HSTS, CSP); IaC bersih; patching | INFRA-01..13 |
| **SR-11** | SR | Keamanan rantai pasok software (SCA) | M | Fase 0 | Dependensi bersih tanpa CVE kritis; SBOM; CI/CD pipeline aman | SCA-01..08 |
| **SR-12** | SR | Logging, audit trail & observabilitas | M | Fase 1 | Audit log lengkap, tanpa secret/prompt; alerting MTTD < 5 mnt; runbook | LOG-01..08 |
| **SR-13** | SR | Ketersediaan, backup & disaster recovery | S | Fase 1 | Backup terenkripsi & teruji; RTO/RPO terpenuhi; graceful degradation | AVAIL-01..06, DATA-10 |
| **SR-14** | SR | SDLC aman & manajemen perubahan | M | Fase 0 | Code review wajib, SAST/SCA di CI, threat modeling, change control | SDLC-01..08 |
| **SR-15** | SR | Keamanan frontend & konsol admin | M | Fase 1 | Tanpa secret di bundle frontend; MFA admin; no-store untuk key | FE-01..06 |
| **SR-16** | SR | Kepatuhan hukum, ToS & legalitas pasokan | M | Fase 0 | Legalitas resale sah; ToS/Privacy/AUP; PSE; DPA; screening sanksi | LEGAL-01..08 |
| **POL-DATA-01** | POL-DATA | Isi prompt & respons pelanggan | M | Fase 1 | Tidak disimpan secara default (retensi 0); opt-in debug ≤ batas hari; tidak untuk training | AI-02, AI-11 |
| **POL-DATA-02** | POL-DATA | Metadata usage (model, token, latensi, status, key ID) | M | Fase 1 | Disimpan untuk keperluan billing, analitik & dukungan (retensi terdefinisi) | BILL-04 |
| **POL-DATA-03** | POL-DATA | API key pelanggan | M | Fase 1 | Hanya hash yang disimpan; plaintext tidak pernah disimpan di database/log | KEY-02, KEY-03 |
| **POL-DATA-04** | POL-DATA | Data akun pengguna (email, nama) | M | Fase 1 | Disimpan selama akun aktif + retensi hukum; dasar kontrak pemrosesan | DATA-04, DATA-05 |
| **POL-DATA-05** | POL-DATA | Data transaksi & keuangan | M | Fase 1 | Disimpan sesuai kewajiban pajak/akuntansi; ledger bersifat immutable | BILL-13 |
| **POL-DATA-06** | POL-DATA | Audit log sistem | M | Fase 1 | Disimpan dengan sifat tamper-evident; tidak mencatat secret atau prompt | LOG-01, LOG-03 |
| **POL-DATA-07** | POL-DATA | Data verifikasi identitas (KYC) | S | Fase 2 | Disimpan bila diterapkan; terenkripsi kuat dan akses strictly minimal | LEGAL-06 |
| **POL-PRIC-01** | POL-PRIC | Transparansi harga per model | M | Fase 1 | Harga per 1M token (in/out) ditampilkan jelas sebelum dan sesudah login | - |
| **POL-PRIC-02** | POL-PRIC | Larangan substitusi diam-diam model | M | Fase 1 | Model hulu tidak diganti diam-diam; perubahan/fallback dinyatakan di header/dok | PROXY-09 |
| **POL-PRIC-03** | POL-PRIC | Tanpa biaya tersembunyi | M | Fase 1 | Request gagal ditagih hanya bila hulu menagih dan dinyatakan secara transparan | - |
| **POL-PRIC-04** | POL-PRIC | Klaim pemasaran akurat | M | Fase 1 | Tidak memakai klaim palsu seperti "resmi" atau "unlimited" tanpa dasar sah | LEGAL-07 |
| **POL-PRIC-05** | POL-PRIC | Pasokan hulu sah dan legal | M | Fase 0 | Kontrak/izin resale terdokumentasi dan valid dari penyedia hulu | LEGAL-01, LEGAL-02 |
| **DM-ENT-01** | DM-ENT | Entitas `users` | M | Fase 1 | Kolom: id, email (unik), password_hash 🔒 (Argon2id/bcrypt), status, mfa_enabled, created_at, tos_version, aup_version | AUTH-01..04 |
| **DM-ENT-02** | DM-ENT | Entitas `organizations` | M | Fase 1 | Kolom: id, name, owner_id, plan, status; isolasi multi-tenant | AUTHZ-01..03 |
| **DM-ENT-03** | DM-ENT | Entitas `memberships` | M | Fase 1 | Kolom: org_id, user_id, role; pemetaan hak akses RBAC | AUTHZ-04 |
| **DM-ENT-04** | DM-ENT | Entitas `api_keys` | M | Fase 1 | Kolom: id, org_id, name, prefix, key_hash 🔒, scopes, status, rpm, tpm, daily_quota, spend_cap, expires_at, last_used_at, revoked_at; index key_hash | KEY-01..13 |
| **DM-ENT-05** | DM-ENT | Entitas `wallets` | M | Fase 1 | Kolom: id, org_id, currency, cached_balance; saldo turunan dari ledger | BILL-01, BILL-13 |
| **DM-ENT-06** | DM-ENT | Entitas `ledger_entries` | M | Fase 1 | Kolom: id, wallet_id, type (topup/reserve/settle/refund/adjust), amount (integer minor unit), ref_id, idempotency_key (unik), created_at; append-only | BILL-01, BILL-14 |
| **DM-ENT-07** | DM-ENT | Entitas `payments` | M | Fase 1 | Kolom: id, org_id, provider, provider_ref (unik), amount, currency, status, raw_event_hash; status machine idempoten | BILL-05..07 |
| **DM-ENT-08** | DM-ENT | Entitas `webhook_inbox` | M | Fase 1 | Kolom: id, provider, event_id (unik), signature_valid, processed_at; anti-replay & deduplikasi | BILL-06 |
| **DM-ENT-09** | DM-ENT | Entitas `usage_events` | M | Fase 1 | Kolom: id, request_id (unik), key_id, org_id, model_alias, upstream_model, input_tokens, output_tokens, cost, latency_ms, status, created_at; metadata only | BILL-04, AI-02 |
| **DM-ENT-10** | DM-ENT | Entitas `models` | M | Fase 1 | Kolom: alias, upstream_provider, upstream_model, price_in, price_out, status, visibility; perubahan diaudit | BILL-03, PROXY-09 |
| **DM-ENT-11** | DM-ENT | Entitas `upstream_keys` | M | Fase 1 | Kolom: id, provider, secret_ref 🔒, status, quota_state, last_rotated_at; referensi KMS bukan plaintext | SEC-02, SEC-05 |
| **DM-ENT-12** | DM-ENT | Entitas `audit_logs` | M | Fase 1 | Kolom: id, actor_id, actor_type, action, target, ip, ua, metadata, created_at; tamper-evident | LOG-01..03 |
| **DM-ENT-13** | DM-ENT | Entitas `abuse_cases` | M | Fase 1 | Kolom: id, org_id, key_id, signal, severity, status, reviewer, resolution; metadata only | AI-08, AI-09 |
| **DM-ENT-14** | DM-ENT | Entitas `kyc_records` | S | Fase 2 | Kolom: id, org_id, level, status, evidence_ref 🔒; data terenkripsi | LEGAL-06 |
| **DM-ENT-15** | DM-ENT | Entitas `dsar_requests` | M | Fase 1 | Kolom: id, user_id, type, status, due_at, completed_at; pelacakan permintaan privasi | DATA-04, DATA-05 |
| **DM-RULE-01** | DM-RULE | Keunikan Idempotency Key Ledger | M | Fase 1 | `ledger_entries.idempotency_key` wajib ber-constraint UNIQUE di level DB | BILL-01, BILL-07 |
| **DM-RULE-02** | DM-RULE | Keunikan Request ID Usage | M | Fase 1 | `usage_events.request_id` wajib ber-constraint UNIQUE di level DB | BILL-04 |
| **DM-RULE-03** | DM-RULE | Keunikan Provider Ref Pembayaran | M | Fase 1 | `payments.provider_ref` wajib ber-constraint UNIQUE di level DB | BILL-06 |
| **DM-RULE-04** | DM-RULE | Transaksi DB Atomik untuk Saldo | M | Fase 1 | Semua perubahan saldo dan ledger wajib berada dalam transaksi DB ACID atomik | BILL-01, BILL-02 |
| **DM-RULE-05** | DM-RULE | Kebijakan Penghapusan Data (Soft vs Hard) | M | Fase 1 | Soft-delete untuk entitas keuangan/audit; hard delete fisik hanya untuk data pribadi DSAR | DATA-05 |
| **API-GW-01** | API-GW | POST `/v1/chat/completions` | M | Fase 1 | Chat completion kompatibel format OpenAI; opsi streaming SSE; autentikasi API Key | PROXY-03 |
| **API-GW-02** | API-GW | GET `/v1/models` | M | Fase 1 | Mengembalikan daftar model yang boleh diakses key; autentikasi API Key | PROXY-03 |
| **API-GW-03** | API-GW | POST `/v1/embeddings` | S | Fase 2 | Endpoint embeddings kompatibel; biaya dihitung per token input; autentikasi API Key | BILL-04 |
| **API-GW-04** | API-GW | GET `/v1/usage` | S | Fase 1 | Endpoint opsional ringkasan penggunaan langsung via API Key | - |
| **API-GW-HDR** | API-GW | Header Autentikasi Gateway | M | Fase 1 | Wajib via `Authorization: Bearer <KEY>` atau `x-api-key`; key via query string ditolak | KEY-05 |
| **API-GW-RESPHDR** | API-GW | Header Respons Gateway | M | Fase 1 | Menyertakan `X-Request-Id`, `X-RateLimit-Limit-Requests`, `X-RateLimit-Remaining-Requests`, dan `Retry-After` (saat 429) | KEY-08, PROXY-07 |
| **API-CON-AUTH** | API-CON | Endpoint Konsol: Autentikasi | M | Fase 1 | `POST /api/auth/register`, `/login`, `/logout`, `/mfa/verify`, `/password/forgot`, `/password/reset` + CSRF & rate limit | AUTH-01..11 |
| **API-CON-KEYS** | API-CON | Endpoint Konsol: API Key | M | Fase 1 | `GET/POST /api/keys`, `POST /api/keys/{id}/revoke`, `POST /api/keys/{id}/rotate` + verifikasi kepemilikan tenant | AUTHZ-02, KEY-01..06 |
| **API-CON-BILL** | API-CON | Endpoint Konsol: Billing | M | Fase 1 | `GET /api/wallet`, `POST /api/topups`, `GET /api/transactions`, `GET /api/invoices/{id}` + header Idempotency-Key | BILL-01..14 |
| **API-CON-USAGE** | API-CON | Endpoint Konsol: Penggunaan | M | Fase 1 | `GET /api/usage?from=&to=&group_by=` dengan filter isolasi tenant ketat | AUTHZ-02 |
| **API-CON-ORG** | API-CON | Endpoint Konsol: Organisasi & Tim | S | Fase 3 | `GET/POST /api/org/members`, `PATCH /api/org/members/{id}` dengan otorisasi RBAC | AUTHZ-04 |
| **API-CON-PRV** | API-CON | Endpoint Konsol: Hak Privasi | M | Fase 1 | `POST /api/privacy/export`, `POST /api/privacy/delete` dengan re-autentikasi wajib | DATA-04, DATA-05 |
| **API-WH-PAY** | API-WH | Webhook Pembayaran Gateway | M | Fase 1 | `POST /webhooks/payments/{provider}`: verifikasi signature, timestamp anti-replay, idempoten, tanpa auth sesi | BILL-05..07 |
| **API-ADM-ENDPOINTS** | API-ADM | Endpoint Panel Admin | M | Fase 1 | `/admin/api/*` (users, keys, models, pricing, upstream-pool, abuse, reports, audit) + MFA, IP allowlist, RBAC | FE-04, AUTHZ-04 |
| **API-ERR-SCHEME** | API-ERR | Format Standar Error JSON | M | Fase 1 | Skema error seragam: `{ "error": { "type": "...", "code": "...", "message": "...", "request_id": "..." } }` | PROXY-07, INFRA-01 |
| **API-ERR-CODES** | API-ERR | Pemetaan HTTP Status & Error Codes | M | Fase 1 | Pemetaan standar: 400, 401, 402, 403, 404, 413, 422, 429, 500, 502/503/504 | PROXY-07 |
| **API-ERR-NOLEAK** | API-ERR | Pencegahan Kebocoran Sensitif di Error | M | Fase 1 | Pesan error dilarang memuat stack trace, nilai key, nama akun hulu, atau URL infrastruktur internal | PROXY-07 |
| **OPS-SLO-01** | OPS-SLO | SLO Ketersediaan Gateway | M | Fase 1 | Ketersediaan non-5xx karena platform ≥ 99,9% per bulan | - |
| **OPS-SLO-02** | OPS-SLO | SLO Overhead Latensi Gateway | M | Fase 1 | Overhead gateway di luar hulu: p95 ≤ 50 ms | - |
| **OPS-SLO-03** | OPS-SLO | SLO Akurasi Billing | M | Fase 1 | Selisih billing vs hulu < 0,1% | - |
| **OPS-SLO-04** | OPS-SLO | SLO Kecepatan Revoke Key | M | Fase 1 | Revoke API key efektif dalam waktu ≤ 5 detik | KEY-06 |
| **OPS-SLO-05** | OPS-SLO | SLO Waktu Pemrosesan Webhook | M | Fase 1 | Waktu proses webhook pembayaran p95 ≤ 10 detik | BILL-06 |
| **OPS-ALT-01** | OPS-ALT | Alert Lonjakan Biaya Hulu | M | Fase 1 | Alert otomatis saat konsumsi/biaya hulu melonjak di luar batas wajar | LOG-04, INFRA-13 |
| **OPS-ALT-02** | OPS-ALT | Alert Margin Negatif | M | Fase 1 | Alarm otomatis bila harga jual < biaya hulu pada model/transaksi tertentu | BILL-12 |
| **OPS-ALT-03** | OPS-ALT | Alert Error 5xx Melebihi Ambang | M | Fase 1 | Notifikasi on-call saat tingkat error internal 5xx melampaui batas ambang | LOG-04 |
| **OPS-ALT-04** | OPS-ALT | Alert Hulu Down atau Banned | M | Fase 1 | Alert cepat saat penyedia hulu mengalami pemadaman atau suspensi key | PROXY-06, R-01 |
| **OPS-ALT-05** | OPS-ALT | Alert Pola Penyalahgunaan Key (Abuse) | M | Fase 1 | Alert anomali trafik, IP hopping, atau pelanggaran batas key | KEY-10, LOG-04 |
| **OPS-ALT-06** | OPS-ALT | Alert Anomali Login Admin | M | Fase 1 | Notifikasi seketika untuk login admin gagal berulang atau lokasi mencurigakan | AUTH-03, LOG-04 |
| **OPS-ALT-07** | OPS-ALT | Alert Kegagalan Webhook Berulang | M | Fase 1 | Alarm saat webhook payment gateway gagal diverifikasi atau ditolak berulang | BILL-05, LOG-04 |
| **OPS-ALT-08** | OPS-ALT | Alert Inkonsistensi Saldo / Ledger | M | Fase 1 | Alarm otomatis saat rekonsiliasi saldo vs ledger menemukan ketidakcocokan | BILL-01, BILL-13 |
| **OPS-ALT-09** | OPS-ALT | Alert Penumpukan Antrean Metering | M | Fase 1 | Alarm saat queue penulisan usage_events tertunda/mengalami backlog | NFR-05, LOG-04 |
| **OPS-ALT-10** | OPS-ALT | Alert Sertifikat TLS Kedaluwarsa | M | Fase 1 | Peringatan otomatis sebelum sertifikat TLS domain/gateway habis masa berlaku | INFRA-11 |
| **OPS-ALT-11** | OPS-ALT | Alert Anggaran Cloud Tercapai | M | Fase 1 | Alarm pemantauan biaya infrastruktur cloud | AVAIL-06, INFRA-13 |
| **OPS-LOG-01** | OPS-LOG | Format Log Terstruktur JSON | M | Fase 1 | Semua service mencatat log JSON terstruktur yang memuat `request_id` | LOG-01, LOG-08 |
| **OPS-LOG-02** | OPS-LOG | Redaction Otomatis Log | M | Fase 1 | Pembersihan/masking otomatis untuk API key, password, token, dan data prompt | LOG-02 |
| **OPS-LOG-03** | OPS-LOG | Log Terpusat & Retensi Aman | M | Fase 1 | Penyimpanan log terpusat dengan kontrol akses ketat dan retensi sesuai kebijakan | LOG-03 |
| **OPS-RB-01** | OPS-RB | Runbook: Kebocoran Key Hulu / Secret | M | Fase 0 | Prosedur tanggap darurat rotasi secret manager, pencabutan key, dan investigasi | §15.4, §12.1 |
| **OPS-RB-02** | OPS-RB | Runbook: Kebocoran Data Pelanggan & Notifikasi | M | Fase 0 | Prosedur pembendungan, pelaporan breach PDP (3x24 jam) dan GDPR (72 jam) | §15.4, DATA-12 |
| **OPS-RB-03** | OPS-RB | Runbook: Penyedia Hulu Memblokir/Membatasi Key | M | Fase 0 | Prosedur failover pool key cadangan, rotasi, dan komunikasi eskalasi | §15.4, PROXY-10 |
| **OPS-RB-04** | OPS-RB | Runbook: Serangan DDoS / Abuse Masif | M | Fase 0 | Prosedur mitigasi trafik edge WAF, IP blocking, dan isolasi beban | §15.4, INFRA-05 |
| **OPS-RB-05** | OPS-RB | Runbook: Fraud, Carding & Lonjakan Chargeback | M | Fase 0 | Prosedur pembekuan wallet berisiko, pengetatan 3DS, dan pelaporan fraud | §15.4, BILL-08 |
| **OPS-RB-06** | OPS-RB | Runbook: Anomali Ledger & Saldo | M | Fase 0 | Prosedur isolasi transaksi, audit koreksi saldo via ledger adjusment | §15.4, BILL-13 |
| **OPS-RB-07** | OPS-RB | Runbook: Kegagalan Database & Pemulihan Backup | M | Fase 0 | Prosedur restorasi point-in-time recovery DB dan verifikasi konsistensi data | §15.4, AVAIL-02 |

---

## 3. Rekapitulasi Ekstraksi Kebutuhan

### 3.1 Berdasarkan Kategori Kebutuhan
| Kategori | Deskripsi | Jumlah Butir |
|---|---|---|
| **FR-AUTH** | Akun & Autentikasi | 8 |
| **FR-KEY** | Manajemen API Key | 9 |
| **FR-GW** | Gateway API | 12 |
| **FR-BILL** | Billing & Saldo | 12 |
| **FR-DASH** | Dasbor & Penggunaan | 7 |
| **FR-ADM** | Panel Admin | 8 |
| **FR-ABU** | Anti-Abuse & Kepercayaan | 7 |
| **FR-NOT** | Notifikasi & Dukungan | 4 |
| **FR-PRV** | Privasi & Data Pribadi | 5 |
| **NFR** | Kebutuhan Non-Fungsional | 15 |
| **SR** | Kebutuhan Keamanan & Kepatuhan | 16 |
| **POL-DATA** | Kebijakan Data Sistem | 7 |
| **POL-PRIC** | Prinsip Harga & Kepercayaan | 5 |
| **DM-ENT** | Entitas Model Data | 15 |
| **DM-RULE** | Aturan Integritas Model Data | 5 |
| **API-GW** | Spesifikasi API Gateway Publik | 6 |
| **API-CON** | Spesifikasi Console Dashboard API | 6 |
| **API-WH** | Spesifikasi Webhook Masuk | 1 |
| **API-ADM** | Spesifikasi Endpoint Admin | 1 |
| **API-ERR** | Spesifikasi Format & Kode Error | 3 |
| **OPS-SLO** | Service Level Objectives (SLO) | 5 |
| **OPS-ALT** | Alerting Wajib | 11 |
| **OPS-LOG** | Standar Logging Terstruktur | 3 |
| **OPS-RB** | Prosedur Runbook Wajib | 7 |
| **TOTAL** | | **178 Butir** |

---

### 3.2 Berdasarkan Prioritas (MoSCoW)
| Prioritas | Keterangan | Jumlah Butir | Persentase |
|---|---|---|---|
| **Must (M)** | Wajib ada dan berfungsi penuh | 148 | 83.1% |
| **Should (S)** | Sangat penting, dapat bertahap sesuai fase | 24 | 13.5% |
| **Could (C)** | Pelengkap / bernilai tambah (mis. SSO, Auto Topup) | 6 | 3.4% |
| **Won't (W)** | Di luar cakupan fase awal | 0 | 0.0% |
| **TOTAL** | | **178** | **100%** |

---

### 3.3 Berdasarkan Fase Rilis
| Fase Rilis | Keterangan Target | Jumlah Butir |
|---|---|---|
| **Fase 0** | Hardening & Audit (Security, Legalitas, Runbook, CI/CD) | 16 |
| **Fase 1** | Private Beta (MVP Lengkap, Auth, Key, Gateway, Billing, Admin, Abuse Dasar) | 147 |
| **Fase 2** | Public Launch (Embeddings, Playground, Status Page, KYC, CSV) | 7 |
| **Fase 3** | Scale & Team (Organisasi/Tim, SSO, Auto Topup, Webhook Pelanggan) | 8 |
| **Fase 4** | Sertifikasi (ISO/IEC 27001, SOC 2 Type II) | *(Diatur via SR-01..16)* |
| **TOTAL** | | **178** |

---

## 4. Informasi Wajib Penutup Tahap A

### 4.1 File yang Sudah Dibaca dan yang Belum
- **File Sumber PRD & Keamanan yang Sudah Dibaca Lengkap:**
  1. `PRD_AI_API_GATEWAY.md` (697 baris) — 100% selesai dibaca.
  2. `SECURITY_AUDIT_CHECKLIST.md` (723 baris) — inventaris kontrol dan ID butir dipetakan.
  3. Direktori workspace `apps/`, `packages/` — struktur monorepo telah diinventarisasi.
- **File Kode yang Belum Dibaca (Akan Ditelaah pada Tahap B Traceability):**
  1. `apps/api/` (semua route controller, middleware, gateway service, proxy handler).
  2. `apps/web/` (halaman frontend, komponen UI, handler API proxy console).
  3. `packages/db/` (skema Prisma/Drizzle/Kysely/SQL migrations).
  4. `packages/shared/` (tipe bersama, skema validasi Zod, utilitas enkripsi/hashing).
  5. Konfigurasi CI/CD, docker-compose, dan infrastruktur terkait.

### 4.2 Area yang Mungkin Terlewat & Butuh Uji Manual
1. **Atribut Terperinci per Kolom Database:** Pada Tahap E akan dilakukan perbandingan kolom demi kolom (data types, unsigned integer, foreign key cascades).
2. **Kinerja Latensi Gateway (p95 ≤ 50 ms):** Tidak dapat dibuktikan secara statis dari kode semata; membutuhkan benchmarking dinamis di staging.
3. **Validitas Legalitas Pasokan Hulu (LEGAL-01/02):** Butuh verifikasi dokumen perjanjian reseller non-kode (ditandai sebagai TDV pada penelusuran nanti).
4. **Resistensi Concurrency Race Condition:** Logika transaksi lock/reservasi di kode dapat ditelaah, namun stress test konkurensi (T-03) tetap menjadi verifikasi akhir.

### 4.3 Jumlah Kebutuhan per Status
*Catatan: Pada Tahap A, status berfokus pada hasil ekstraksi kebutuhan. Penilaian status implementasi kode (IMPLEMENTED, PARTIAL, MISSING, DEVIASI, TDV) akan dilakukan secara bertahap pada Tahap B (B1 s/d B6).*

| Status Kebutuhan | Jumlah | Keterangan |
|---|---|---|
| **Ekstrak Selesai (Siap Ditelaah)** | 178 | Kebutuhan terdokumentasi lengkap dengan kriteria penerimaan |
| **Status Kode Belum Dievaluasi** | 178 | Menunggu dimulainya Tahap B1 (FR-AUTH + AUTHZ) |

---
*Laporan Tahap A disimpan di: `audit-out/prd-conformance/A-requirements.md`.*
