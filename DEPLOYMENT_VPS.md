# Morphic Gateway — VPS Deployment & Reverse Proxy Guide

Panduan konfigurasi VPS untuk produksi mandiri (self-hosted VPS) tanpa Cloudflare CDN.

---

## 1. Topologi & Arsitektur Jaringan

- **API Process**: Mengikat (bind) hanya ke loopback lokal `127.0.0.1:3001` (atau port yang ditentukan). Jangan pernah membuka port Node.js langsung ke internet publik.
- **TLS Termination**: Nginx bertindak sebagai reverse proxy dan mengakhiri TLS pada port **443** (HTTPS).
  * *Catatan Penting PayPal*: Webhook PayPal **hanya** dikirimkan ke port 443 dengan sertifikat SSL/TLS valid (misalnya Let's Encrypt / Certbot).
- **Single Instance**: Jalankan **satu instance** API Node.js di VPS (via systemd atau PM2).
- **Redis Wajib**: `REDIS_URL` harus aktif. Tanpa Redis, rate limiter akan jatuh ke in-memory store lokal yang tidak sinkron dan hilang saat restart.

---

## 2. Konfigurasi Nginx Wajib

Tambahkan blok konfigurasi reverse proxy berikut pada server block Nginx Anda:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;          # Arahkan ke port internal Morphic API
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;

    # PENTING: Timpa (overwrite) X-Forwarded-For dengan IP koneksi nyata ($remote_addr).
    # Jangan gunakan $proxy_add_x_forwarded_for karena klien luar dapat menyuntikkan IP palsu
    # di awal header untuk mengelabui rate limiter atau bypass IP filter.
    proxy_set_header X-Forwarded-For $remote_addr;

    # Beri tahu API bahwa request asli masuk lewat HTTPS
    proxy_set_header X-Forwarded-Proto $scheme;

    # Kosongkan / hapus header CF-Connecting-IP dari klien luar.
    # Karena deployment ini tidak menggunakan Cloudflare, header ini bisa dipalsukan oleh penyerang
    # jika tidak dibersihkan di level reverse proxy Nginx.
    proxy_set_header CF-Connecting-IP "";

    # Konfigurasi buffer & timeout standar
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_connect_timeout 15s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
}
```

### Penjelasan Setiap Header:
1. `proxy_pass http://127.0.0.1:3001`: Meneruskan traffic ke API internal yang hanya mendengarkan di loopback.
2. `proxy_set_header Host $host`: Menyampaikan nama domain yang diminta klien.
3. `proxy_set_header X-Real-IP $remote_addr`: Menyampaikan alamat IP klien terluar yang terhubung ke Nginx.
4. `proxy_set_header X-Forwarded-For $remote_addr`: Menimpa header hop dengan IP remote asli Nginx. Ini mencegah penyerang mengirim `X-Forwarded-For: 1.1.1.1` buatan sendiri.
5. `proxy_set_header X-Forwarded-Proto $scheme`: Menyampaikan protokol (`https`) ke API Hono.
6. `proxy_set_header CF-Connecting-IP ""`: Menghapus header Cloudflare palsu yang dikirim oleh penyerang untuk merusak rate limiting.

---

## 3. Checklist Sebelum Go-Live di VPS

1. [ ] Sertifikat SSL/TLS aktif pada domain dan listen di port 443.
2. [ ] API terikat ke `127.0.0.1`, firewall VPS (UFW) menutup port internal (3001).
3. [ ] `REDIS_URL` terhubung ke instance Redis lokal atau terproteksi password.
4. [ ] Environment `NODE_ENV=production` dan `PAYPAL_ENVIRONMENT=live` terpasang.
5. [ ] Webhook URL terdaftar di PayPal Live REST App: `https://<api-domain>/webhooks/paypal`.
6. [ ] Periksa log boot API saat pertama kali dijalankan: pastikan tidak ada peringatan loopback IP `[ip] client IP resolved to loopback...`.
