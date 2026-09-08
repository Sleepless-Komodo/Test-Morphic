'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Locale = 'id' | 'en';

export const TRANSLATIONS = {
  id: {
    nav: {
      models: 'Models',
      integration: 'Integrasi IDE',
      features: 'Keunggulan',
      faq: 'FAQ',
      login: 'Masuk',
      getStarted: 'Mulai',
      dashboard: 'Dashboard',
    },
    hero: {
      badge: 'Satu API untuk Berbagai Model AI',
      headline: 'Satu Kunci API untuk Semua Model AI Terbaik.',
      headlineSub: '',
      subheadline:
        'Akses Claude 3.5, DeepSeek V4, Qwen, dan Kimi tanpa ribet kartu kredit internasional. Hemat biaya token dengan pembayaran QRIS lokal instan.',
      primaryCta: 'Dapatkan API Key',
      secondaryCta: 'Eksplorasi Model',
      manageKeys: 'Buka Panel API Keys',
    },
    terminal: {
      badge: 'Setup 1 Menit',
      title: 'Kompatibel Penuh. Tanpa Ubah Workflow.',
      desc: 'Cukup ganti Base URL ke endpoint Morphic dan masukkan API Key Anda. Langsung jalan di Cursor, Cline, Windsurf, dan SDK OpenAI.',
      copy: 'Salin',
      copied: 'Tersalin!',
      testing: 'Menghubungkan ke endpoint Morphic...',
      connected: 'Terhubung dalam 140ms • HTTP 200 OK',
    },
    steps: {
      badge: 'Panduan Mudah & Cepat',
      title: '4 Langkah Mudah Menggunakan API Key AI',
      desc: 'Hanya butuh waktu kurang dari 2 menit untuk menghubungkan agent AI pilihan Anda dan langsung mulai coding tanpa ribet.',
      step1Num: '01',
      step1Title: 'Pilih Paket & Scan QRIS',
      step1Desc: 'Pilih kuota kredit sesuai kebutuhan Anda. Bayar seketika menggunakan QRIS (GoPay, OVO, Dana, BCA, Mandiri) tanpa kartu kredit. Saldo masuk detik itu juga.',
      step1Badge: 'Instan 3 Detik',
      step2Num: '02',
      step2Title: 'Generate API Key Unik',
      step2Desc: 'Buka Dashboard dan buat kunci rahasia (mp-xxxx) Anda. Anda bebas membuat multiple keys dengan label terpisah (misal: "Cursor Work", "Production").',
      step2Badge: 'Multi-Key Ready',
      step3Num: '03',
      step3Title: 'Tempel di Cursor / IDE Anda',
      step3Desc: 'Ganti Base URL menjadi https://api.morphic.id/v1 dan masukkan API Key Anda. 100% kompatibel dengan Cursor, Cline, Windsurf, dan SDK resmi OpenAI.',
      step3Badge: 'OpenAI Format',
      step4Num: '04',
      step4Title: 'Agent AI Aktif Bekerja',
      step4Desc: 'Coding agent Anda langsung siap mengeksekusi prompt, debugging, dan auto-complete dengan rate limit tinggi (hingga 180 RPM) tanpa hambatan.',
      step4Badge: 'High Concurrency',
      footerNote: 'Didukung arsitektur multi-provider proxy dengan failover otomatis dan latensi response rendah.',
      ctaLoggedIn: 'Buka Panel API Keys',
      ctaGuest: 'Daftar & Mulai Sekarang',
    },
    problemSolution: {
      badge: 'Mengapa Perlu Gateway API Key?',
      title: 'Tinggalkan Cara Lama yang Rumit & Mahal.',
      desc: 'Morphic hadir memecahkan kendala utama developer saat mengakses model AI global untuk coding dan production harian.',
      problemLabel: 'Kendala Provider Biasa:',
      solutionLabel: 'Solusi Morphic:',
      card1Problem: 'Wajib Kartu Kredit Internasional (USD)',
      card1ProblemDesc: 'Provider resmi luar negeri menolak pembayaran lokal dan mengenakan kurs konversi valas tinggi.',
      card1Solution: 'Bayar Instan dengan QRIS & Rupiah',
      card1SolutionDesc: 'Cukup scan QRIS via GoPay, OVO, Dana, BCA, Mandiri, atau bank lokal mana pun tanpa kartu kredit.',
      card2Problem: 'Akun Sering Terkena Rate-Limit & Banned',
      card2ProblemDesc: 'Coding agent seperti Cursor dan Cline mengirim ratusan prompt per menit yang memicu limit ketat provider.',
      card2Solution: 'High Concurrency & Turbo RPM',
      card2SolutionDesc: 'Infrastruktur routing khusus dengan burst rate tinggi (hingga 180 RPM) dirancang tahan beban multi-agent.',
      card3Problem: 'Saldo Terpecah di Banyak Provider',
      card3ProblemDesc: 'Harus deposit modal terpisah di DeepSeek, Alibaba Cloud, dan Moonshot. Saldo mengendap dan boros.',
      card3Solution: 'Unified Credits: 1 Saldo untuk Semua Model',
      card3SolutionDesc: 'Satu saldo kredit Morphic dapat digunakan bebas bergantian antara DeepSeek V4, Qwen Max, Kimi, dan lainnya.',
      card4Problem: 'Setup API Endpoint Rumit & Berbeda Format',
      card4ProblemDesc: 'Setiap provider memiliki format API, SDK, dan sistem autentikasi berbeda yang menyulitkan integrasi.',
      card4Solution: '100% OpenAI Format Compatible',
      card4SolutionDesc: 'Gunakan endpoint standar /v1/chat/completions. Cukup ganti Base URL dan pasang langsung di IDE Anda.',
    },
    models: {
      badge: 'Direktori Model',
      title: 'Akses Langsung ke Model AI Pilihan',
      desc: 'Beralih dengan mudah antara model coding, reasoning, dan chat dengan tarif transparan.',
      searchPlaceholder: 'Cari model atau provider (misal: claude, deepseek)...',
      filterAll: 'Semua Model',
      filterCoding: 'Coding',
      filterReasoning: 'Reasoning',
      filterChat: 'Chat',
      filterMultimodal: 'Multimodal',
      priceLabel: 'Tarif Harian',
      speedLabel: 'Estimasi Kecepatan',
      contextLabel: 'Context Window',
      useModel: 'Gunakan Model',
      viewAllModels: 'Lihat Seluruh Katalog Model (/models)',
      modelsCount: 'model tersedia',
      noResults: 'Tidak ada model yang cocok dengan pencarian Anda.',
      memberPricingBadge: 'Paket Harian & Fleksibel',
      memberPricingTitle: 'Akses Paket Harian Mulai Rp 1.000 - Rp 4.500 / Hari',
      memberPricingDesc:
        'Paket harga harian hemat dan mikro top-up saldo dapat diakses langsung melalui dashboard member setelah Anda melakukan autentikasi.',
      memberPricingPerk1: 'Top-up QRIS instan',
      memberPricingPerk2: 'Tanpa langganan mengikat',
      memberPricingPerk3: 'Bebas ganti model di IDE',
      memberPricingBtnGuest: 'Masuk untuk Melihat & Membeli Paket',
      memberPricingBtnMember: 'Buka Dashboard & Beli Paket',
      memberPricingCaption: 'Aktivasi otomatis & siap pakai dalam hitungan detik',
    },
    cta: {
      badge: 'Gateway Terpadu',
      title: 'Satu API untuk berbagai model AI.',
      desc: 'Hubungkan IDE Anda dalam hitungan detik. Bayar dalam Rupiah via QRIS, nikmati rate limit tinggi, dan kelola semua token dalam satu saldo terpadu.',
      getStartedBtn: 'Mulai Coding Sekarang',
      viewModelsBtn: 'Lihat Katalog Model',
    },
    login: {
      backHome: 'Kembali ke Beranda',
      title: 'Masuk ke Morphic',
      subtitle: 'Pilih akun Google atau GitHub Anda untuk mengakses dashboard dan mengelola API key.',
      googleBtn: 'Lanjutkan dengan Google',
      githubBtn: 'Lanjutkan dengan GitHub',
      keyOption: 'Punya API key? Masuk pakai key',
      keyTitle: 'Masuk dengan API Key',
      keyPlaceholder: 'Masukkan API key Anda (contoh: mp-live-...)',
      keySubmit: 'Verifikasi & Masuk',
      keyCancel: 'Gunakan login Google / GitHub',
      alreadyLoggedIn: 'Masih login sebagai',
      goToDashboard: 'Buka Dashboard',
      switchAccount: 'Ganti Akun / Keluar',
      termsNotice: 'Dengan masuk, Anda menyetujui ketentuan penggunaan layanan Morphic dan kebijakan privasi kami.',
    },
    faq: {
      badge: 'Tanya Jawab Seputar Layanan',
      title: 'Pertanyaan yang Sering Diajukan',
      desc: 'Segala hal yang perlu Anda ketahui tentang kemudahan, keamanan, dan keunggulan API Key Morphic.',
    },
    footer: {
      rights: 'Hak cipta dilindungi.',
      tagline: 'Gateway API Key AI Terpercaya untuk Developer Indonesia.',
      morphicSub: 'Klik atau arahkan kursor untuk melihat status layanan.',
    },
    dashboard: {
      consoleBadge: 'Morphic Developer Console / Serverless Gateway',
      title: 'Dashboard API & Paket Harian',
      desc: 'Pilih paket harian di bawah Rp 10.000 atau saldo mikro untuk mengaktifkan kunci API Anda ke Cursor, Cline, & Windsurf.',
      nodeStatus: 'Node Status',
      intelligenceRouterActive: 'INTELLIGENCE ROUTER ACTIVE',
      failoverGateway: 'Multi-Provider Failover Gateway',
      failoverDesc: 'Setiap request API dialihkan otomatis ke endpoint terdekat dengan burst rate 180 RPM dan failover tanpa downtime.',
      latency: 'LATENCY',
      burstLimit: 'BURST LIMIT',
      upstream: 'UPSTREAM',
      online: 'Online',
      gatewayNodes: 'Gateway Nodes',
      region: 'Region: ap-southeast-1',
      active: 'Active',
      serverlessEndpoint: 'SERVERLESS ENDPOINT',
      openAiCompatible: 'OpenAI Compatible',
      copy: 'Salin',
      copied: 'Tersalin!',
      baseUrlDesc: 'Pasang sebagai OpenAI Base URL di Cursor, Cline, Windsurf, atau SDK resmi.',
      creditBalance: 'SALDO KREDIT AKTIF',
      live: 'Live',
      creditsDesc: 'Unified Credits aktif untuk seluruh model coding & chat.',
      topUpQris: 'Top-up Saldo via QRIS',
      dailyPackages: 'PAKET HARIAN',
      fromPrice: 'Mulai Rp 2.500 / Hari',
      packagesDesc: '7 opsi paket harian 24 jam & saldo mikro di bawah Rp 10.000 via QRIS.',
      activeKeys: 'ACTIVE KEYS',
      keysActiveCount: 'Kunci Aktif',
      keysDesc: 'Kelola multiple token untuk laptop, PC kantor, dan staging server.',
      modelCatalog: 'KATALOG MODEL',
      modelsCount: '20+ Model Pilihan',
      modelsDesc: 'DeepSeek V4, R1, Qwen Max, Kimi 256K, Claude Sonnet siap panggil.',
      packagesBadge: 'PAKET HARIAN < RP 10.000',
      packagesTitle: 'Pilihan Paket Harian & Saldo Mikro',
      packagesSubtitle: 'Beli paket sesuai hari coding Anda. Pembayaran instan via QRIS (BCA, Mandiri, GoPay, OVO, Dana).',
      yourBalance: 'SALDO ANDA',
      selected: '✓ Terpilih',
      buyQris: 'Beli via QRIS',
      voucherTitle: 'Punya Kode Voucher / Promo?',
      voucherSubtitle: 'Masukkan kode untuk mengklaim saldo uji coba gratis.',
      claim: 'Klaim',
      voucherPlaceholder: 'Contoh: MP-DEV-TEST',
      checkoutQris: 'CHECKOUT QRIS',
      scanQrisDesc: 'Scan QRIS menggunakan GoPay, OVO, Dana, BCA, atau Mandiri.',
      confirmPayment: 'Konfirmasi Pembayaran Selesai',
      paymentSuccess: 'Pembayaran Sukses! Saldo Bertambah.',
      keysSectionTitle: 'Kelola Kunci API',
      keysSectionDesc: 'Kunci API terhubung ke saldo kredit Anda. Pasang di Cursor, Cline, Windsurf, ataupun SDK resmi OpenAI.',
      chatCompletionsCompatible: 'Kompatibel /v1/chat/completions',
      multipleKeysSupport: 'Bebas buat multiple keys untuk testing',
      newKeyLabel: 'LABEL KUNCI BARU',
      newKeyPlaceholder: 'Contoh: Cursor Laptop Kerja',
      creatingKey: 'Membuat...',
      createKey: 'Buat Key',
      yourKeysList: 'KUNCI AKTIF ANDA',
      justNow: 'Baru saja',
      today: 'Hari ini',
      catalogBadge: 'DAFTAR LENGKAP MODEL & TARIF HARIAN',
      catalogTitle: 'Katalog Model & Contoh Tarif per Hari',
      catalogDesc: 'Seluruh model di bawah dapat dipanggil melalui Base URL dan Master API Key yang sama.',
      searchPlaceholder: 'Cari model...',
      capabilities: 'KAPABILITAS',
      activeModelsSuffix: 'model aktif',
      dailyEstimate: 'Estimasi Harian:',
      context: 'Context:',
      navOverview: 'Ringkasan',
      navKeys: 'Kunci API',
      navModels: 'Model',
      navBilling: 'Tagihan & Top-up',
      navVoucher: 'Voucher',
      navUsage: 'Penggunaan',
      balanceLabel: 'Saldo:',
      refreshBalance: 'Refresh Saldo',
      copyBaseUrl: 'Salin Base URL',
      allCapabilities: 'Semua',
      openAiCompatibleBadge: '100% OpenAI Compatible',

      // Subpage Keys
      keysPageTitle: 'Kunci API',
      keysPageSubtitle: 'Kelola token rahasia untuk menghubungkan Morphic AI Gateway ke Cursor, Cline, Windsurf, ataupun SDK resmi OpenAI.',
      createKeyBtn: 'Buat Kunci API',
      creatingKeyBtn: 'Membuat...',
      keyNameInputPlaceholder: 'Nama kunci (contoh: Cursor Laptop Kerja)',
      noKeysFound: 'Belum ada kunci API. Buat kunci baru di atas.',
      thName: 'Nama',
      thKey: 'Kunci',
      thStatus: 'Status',
      thLastUsed: 'Terakhir Digunakan',
      thCreated: 'Dibuat',
      thAction: 'Aksi',
      revokeBtn: 'Cabut',
      revealKeyPrompt: 'Kunci API baru Anda (hanya ditampilkan sekali):',
      revealKeyWarning: 'Simpan kunci ini di tempat aman. Kunci tidak dapat dilihat lagi setelah Anda meninggalkan halaman ini.',
      quickstartTitle: 'Panduan Integrasi Cepat di Cursor / Cline',
      quickstartDesc: 'Pasang konfigurasi berikut di settings AI IDE Anda:',

      // Subpage Models
      modelsPageTitle: 'Katalog Model & Tarif Harian',
      modelsPageSubtitle: 'Gunakan model ID di Cursor, Cline, atau kode Anda — Morphic secara otomatis mengarahkan ke provider upstream yang sesuai.',
      modelsSearchPlaceholder: 'Cari model atau provider...',
      filterAllCap: 'Semua Kapabilitas',
      modelStatusReady: 'Ready',
      dailyRateLabel: 'Estimasi Harian:',
      curlSampleTitle: 'Contoh Request cURL (/v1/chat/completions)',

      // Subpage Billing
      billingPageTitle: 'Billing & Paket Harian',
      billingPageSubtitle: 'Beli paket harian di bawah Rp 10.000 atau saldo kredit instan via QRIS.',
      activeBalanceLabel: 'Saldo Aktif',
      billingPackagesTitle: 'Pilihan Paket Harian & Mikro (< Rp 10.000)',
      scanQrisInstantBadge: 'Scan QRIS Instan',
      duration24h: '24 Jam Pass',
      flexibleDuration: 'Fleksibel',
      buyPackageBtn: 'Beli Paket',
      activePassesTitle: 'Pass Harian Aktif Anda',
      activeStatusBadge: 'Aktif',
      expiresPrefix: 'Kedaluwarsa:',
      qrisHistoryTitle: 'Riwayat Pembayaran QRIS',
      noPaymentsHistory: 'Belum ada transaksi pembayaran.',

      // Subpage Voucher / Redeem
      redeemPageTitle: 'Klaim Kode Voucher',
      redeemPageSubtitle: 'Masukkan kode promosi atau voucher developer untuk mengklaim saldo kredit gratis.',
      voucherCardTitle: 'Punya Kode Kupon / Hadiah?',
      voucherCardDesc: 'Saldo gratis akan langsung ditambahkan ke akun Morphic Anda setelah kode diverifikasi.',
      voucherInputLabel: 'KODE VOUCHER',
      voucherInputPlaceholder: 'Contoh: MORPHIC-DEV-2026',
      redeemSubmitBtn: 'Klaim Sekarang',
      redeemingBtn: 'Memverifikasi...',
      termsCardTitle: 'Ketentuan Penggunaan Voucher',
      termItem1: 'Setiap kode voucher hanya dapat diklaim 1x per akun.',
      termItem2: 'Saldo yang diklaim langsung aktif dan dapat digunakan di seluruh model.',
      termItem3: 'Tidak memerlukan kartu kredit atau komitmen biaya bulanan.',

      // Subpage Usage
      usagePageTitle: 'Penggunaan & Analisis Token',
      usagePageSubtitle: 'Pantau riwayat konsumsi token kredit dan pemanggilan model AI Anda secara real-time.',
      usageToday: 'Hari Ini',
      usageThisMonth: 'Bulan Ini',
      usageTotalRequests: 'Total Permintaan',
      usageCreditsUnit: 'credits',
      usageAllTimeUnit: 'sepanjang waktu',
      usageByModelTitle: 'Penggunaan per Model',
      usageRecentTitle: 'Riwayat Aktivitas Pemanggilan Terakhir',
      thUsageModel: 'Model',
      thUsageCredits: 'Kredit',
      thUsageRequests: 'Permintaan',
      thUsageTokens: 'Token',
      thUsageLatency: 'Latensi',
      thUsageTime: 'Waktu',
      noUsageHistory: 'Belum ada riwayat aktivitas pemanggilan API. Mulai kirim prompt dari Cursor atau Cline Anda!',
      signOut: 'Keluar',
    },
  },
  en: {
    nav: {
      models: 'Models',
      integration: 'IDE Integration',
      features: 'Features',
      faq: 'FAQ',
      login: 'Sign In',
      getStarted: 'Get Started',
      dashboard: 'Dashboard',
    },
    hero: {
      badge: 'One API for Multiple AI Models',
      headline: 'One Single API Key for the Best AI Models.',
      headlineSub: '',
      subheadline:
        'Access Claude 3.5, DeepSeek V4, Qwen, and Kimi without international credit card friction. Save up to 70% with instant local QRIS top-up.',
      primaryCta: 'Get API Key',
      secondaryCta: 'Explore Models',
      manageKeys: 'Open API Keys Panel',
    },
    terminal: {
      badge: '1-Minute Setup',
      title: 'Full Compatibility. Zero Workflow Changes.',
      desc: 'Simply change your Base URL to Morphic endpoint and drop in your API key. Works seamlessly with Cursor, Cline, Windsurf, and standard OpenAI SDKs.',
      copy: 'Copy',
      copied: 'Copied!',
      testing: 'Connecting to Morphic endpoint...',
      connected: 'Connected in 140ms • HTTP 200 OK',
    },
    steps: {
      badge: 'Quick & Easy Setup',
      title: '4 Simple Steps to Use Morphic AI API Key',
      desc: 'It takes less than 2 minutes to connect your preferred AI agent and start coding without friction.',
      step1Num: '01',
      step1Title: 'Choose Plan & Scan QRIS',
      step1Desc: 'Select credit packs to match your needs. Pay instantly with QRIS (GoPay, OVO, Dana, BCA, Mandiri) without foreign credit cards. Balance credited in seconds.',
      step1Badge: 'Instant 3s',
      step2Num: '02',
      step2Title: 'Generate Unique API Key',
      step2Desc: 'Open your Dashboard and generate your secret key (mp-xxxx). Freely create multiple keys with custom labels (e.g. "Cursor Work", "Production").',
      step2Badge: 'Multi-Key Ready',
      step3Num: '03',
      step3Title: 'Paste in Cursor / Your IDE',
      step3Desc: 'Change Base URL to https://api.morphic.id/v1 and enter your API Key. 100% compatible with Cursor, Cline, Windsurf, and standard OpenAI SDKs.',
      step3Badge: 'OpenAI Format',
      step4Num: '04',
      step4Title: 'AI Agent Active & Working',
      step4Desc: 'Your coding agent is immediately ready for prompts, debugging, and code completions with high rate limits (up to 180 RPM) without interruption.',
      step4Badge: 'High Concurrency',
      footerNote: 'Powered by multi-provider proxy architecture with automatic failover and low response latency.',
      ctaLoggedIn: 'Open API Keys Panel',
      ctaGuest: 'Sign Up & Get Started',
    },
    problemSolution: {
      badge: 'Why Choose an AI API Gateway?',
      title: 'Ditch the Complex & Costly Legacy Way.',
      desc: 'Morphic solves the biggest roadblocks for developers accessing premier global AI models for daily coding and production workloads.',
      problemLabel: 'Direct Provider Hurdles:',
      solutionLabel: 'Morphic Solution:',
      card1Problem: 'Requires International USD Credit Card',
      card1ProblemDesc: 'Overseas official providers decline local payment methods and charge hefty foreign currency conversion fees.',
      card1Solution: 'Instant Payment with QRIS & IDR',
      card1SolutionDesc: 'Simply scan QRIS with GoPay, OVO, Dana, BCA, Mandiri, or any local bank without international credit cards.',
      card2Problem: 'Frequent Rate-Limits & Account Bans',
      card2ProblemDesc: 'Autonomous coding agents like Cursor and Cline dispatch hundreds of prompts per minute, triggering strict limits.',
      card2Solution: 'High Concurrency & Turbo RPM',
      card2SolutionDesc: 'Dedicated routing infrastructure engineered with high burst capacity (up to 180 RPM) for multi-agent workloads.',
      card3Problem: 'Fragmented Balances Across Providers',
      card3ProblemDesc: 'Having to prefund separate accounts on DeepSeek, Alibaba Cloud, and Moonshot locks up working capital.',
      card3Solution: 'Unified Credits: 1 Balance for All Models',
      card3SolutionDesc: 'A single Morphic credit balance lets you freely switch between DeepSeek V4, Qwen Max, Kimi, and more.',
      card4Problem: 'Disjointed API Setups & Differing Schemas',
      card4ProblemDesc: 'Each provider enforces distinct API formats, proprietary SDKs, and authentication flows that hinder integration.',
      card4Solution: '100% OpenAI Format Compatible',
      card4SolutionDesc: 'Drop-in standard /v1/chat/completions endpoint. Just replace the Base URL and plug directly into your IDE.',
    },
    models: {
      badge: 'Model Directory',
      title: 'Direct Access to Premier AI Models',
      desc: 'Switch seamlessly between top coding, reasoning, and chat models with transparent rates.',
      searchPlaceholder: 'Search model or provider (e.g. claude, deepseek)...',
      filterAll: 'All Models',
      filterCoding: 'Coding',
      filterReasoning: 'Reasoning',
      filterChat: 'Chat',
      filterMultimodal: 'Multimodal',
      priceLabel: 'Daily Rate',
      speedLabel: 'Estimated Speed',
      contextLabel: 'Context Window',
      useModel: 'Use Model',
      viewAllModels: 'View Full Model Directory (/models)',
      modelsCount: 'models available',
      noResults: 'No models found matching your search query.',
      memberPricingBadge: 'Daily & Flexible Pass',
      memberPricingTitle: 'Daily Access Packs Starting from Rp 1,000 - Rp 4,500 / Day',
      memberPricingDesc:
        'Affordable daily passes and micro-balance top-ups can be accessed directly through the member dashboard once authenticated.',
      memberPricingPerk1: 'Instant QRIS top-up',
      memberPricingPerk2: 'No monthly lock-in',
      memberPricingPerk3: 'Switch models freely in IDE',
      memberPricingBtnGuest: 'Sign In to View & Purchase Plans',
      memberPricingBtnMember: 'Open Dashboard & Buy Plans',
      memberPricingCaption: 'Instant activation & ready to use in seconds',
    },
    cta: {
      badge: 'Unified Gateway',
      title: 'One API for multiple AI models.',
      desc: 'Connect your IDE in seconds. Pay in Indonesian Rupiah with QRIS, enjoy high rate limits, and manage all your tokens in one unified balance.',
      getStartedBtn: 'Start Coding Now',
      viewModelsBtn: 'Browse Model Catalog',
    },
    login: {
      backHome: 'Back to Home',
      title: 'Sign in to Morphic',
      subtitle: 'Sign in with Google or GitHub to access your dashboard and manage API keys.',
      googleBtn: 'Continue with Google',
      githubBtn: 'Continue with GitHub',
      keyOption: 'Already have an API key? Sign in with your key',
      keyTitle: 'Sign In with API Key',
      keyPlaceholder: 'Enter your API key (e.g. mp-live-...)',
      keySubmit: 'Verify & Enter',
      keyCancel: 'Use Google / GitHub login instead',
      alreadyLoggedIn: 'Signed in as',
      goToDashboard: 'Go to Dashboard',
      switchAccount: 'Switch Account / Sign Out',
      termsNotice: 'By signing in, you agree to Morphic Terms of Service and Privacy Policy.',
    },
    faq: {
      badge: 'Frequently Asked Questions',
      title: 'Everything You Need to Know',
      desc: 'Answers to common questions about Morphic rates, compatibility, speed, and privacy.',
    },
    footer: {
      rights: 'All rights reserved.',
      tagline: 'The Premier AI API Gateway for Modern Developers.',
      morphicSub: 'Hover or click to inspect live gateway telemetry.',
    },
    dashboard: {
      consoleBadge: 'Morphic Developer Console / Serverless Gateway',
      title: 'API Dashboard & Daily Passes',
      desc: 'Choose daily plans under Rp 10,000 or flexible micro-credits to activate your API keys in Cursor, Cline, & Windsurf.',
      nodeStatus: 'Node Status',
      intelligenceRouterActive: 'INTELLIGENCE ROUTER ACTIVE',
      failoverGateway: 'Multi-Provider Failover Gateway',
      failoverDesc: 'Every API request is automatically routed to the nearest regional endpoint with 180 RPM burst limits and zero-downtime failover.',
      latency: 'LATENCY',
      burstLimit: 'BURST LIMIT',
      upstream: 'UPSTREAM',
      online: 'Online',
      gatewayNodes: 'Gateway Nodes',
      region: 'Region: ap-southeast-1',
      active: 'Active',
      serverlessEndpoint: 'SERVERLESS ENDPOINT',
      openAiCompatible: 'OpenAI Compatible',
      copy: 'Copy',
      copied: 'Copied!',
      baseUrlDesc: 'Use as OpenAI Base URL in Cursor, Cline, Windsurf, or official SDKs.',
      creditBalance: 'ACTIVE CREDIT BALANCE',
      live: 'Live',
      creditsDesc: 'Unified Credits active across all coding, reasoning, and chat models.',
      topUpQris: 'Top-up Balance via QRIS',
      dailyPackages: 'DAILY PASSES',
      fromPrice: 'From Rp 2,500 / Day',
      packagesDesc: '7 daily 24-hour passes & micro-balances under Rp 10,000 via instant QRIS.',
      activeKeys: 'ACTIVE KEYS',
      keysActiveCount: 'Active Keys',
      keysDesc: 'Manage multiple tokens for your laptop, work PC, and staging servers.',
      modelCatalog: 'MODEL CATALOG',
      modelsCount: '20+ Premier Models',
      modelsDesc: 'DeepSeek V4, R1, Qwen Max, Kimi 256K, Claude Sonnet ready to call.',
      packagesBadge: 'DAILY PASSES < RP 10,000',
      packagesTitle: 'Daily Passes & Micro-Credit Plans',
      packagesSubtitle: 'Buy passes based on your coding schedule. Instant payments via QRIS (BCA, Mandiri, GoPay, OVO, Dana).',
      yourBalance: 'YOUR BALANCE',
      selected: '✓ Selected',
      buyQris: 'Buy via QRIS',
      voucherTitle: 'Have a Promo / Voucher Code?',
      voucherSubtitle: 'Enter your code to claim free trial developer credits.',
      claim: 'Redeem',
      voucherPlaceholder: 'e.g. MP-DEV-TEST',
      checkoutQris: 'QRIS CHECKOUT',
      scanQrisDesc: 'Scan QRIS using GoPay, OVO, Dana, BCA, or Mandiri.',
      confirmPayment: 'Confirm Payment Completed',
      paymentSuccess: 'Payment Successful! Credits Added.',
      keysSectionTitle: 'Manage API Keys',
      keysSectionDesc: 'API keys are linked to your credit balance. Drop them into Cursor, Cline, Windsurf, or official OpenAI SDKs.',
      chatCompletionsCompatible: 'Compatible with /v1/chat/completions',
      multipleKeysSupport: 'Create unlimited separate keys for testing',
      newKeyLabel: 'NEW KEY LABEL',
      newKeyPlaceholder: 'e.g. Cursor Work Laptop',
      creatingKey: 'Creating...',
      createKey: 'Create Key',
      yourKeysList: 'YOUR ACTIVE KEYS',
      justNow: 'Just now',
      today: 'Today',
      catalogBadge: 'FULL MODEL DIRECTORY & DAILY RATES',
      catalogTitle: 'Model Catalog & Daily Pricing Guide',
      catalogDesc: 'All models below can be invoked using the exact same Base URL and Master API Key.',
      searchPlaceholder: 'Search models...',
      capabilities: 'CAPABILITIES',
      activeModelsSuffix: 'models active',
      dailyEstimate: 'Daily Estimate:',
      context: 'Context:',
      navOverview: 'Overview',
      navKeys: 'API Keys',
      navModels: 'Models',
      navBilling: 'Billing & Top-up',
      navVoucher: 'Voucher',
      navUsage: 'Usage',
      balanceLabel: 'Balance:',
      refreshBalance: 'Refresh Balance',
      copyBaseUrl: 'Copy Base URL',
      allCapabilities: 'All',
      openAiCompatibleBadge: '100% OpenAI Compatible',

      // Subpage Keys
      keysPageTitle: 'API Keys',
      keysPageSubtitle: 'Manage secret tokens to connect Morphic AI Gateway to Cursor, Cline, Windsurf, or official OpenAI SDKs.',
      createKeyBtn: 'Create API Key',
      creatingKeyBtn: 'Creating...',
      keyNameInputPlaceholder: 'Key name (e.g. Cursor Work Laptop)',
      noKeysFound: 'No API keys yet. Create one above.',
      thName: 'Name',
      thKey: 'Key',
      thStatus: 'Status',
      thLastUsed: 'Last Used',
      thCreated: 'Created',
      thAction: 'Action',
      revokeBtn: 'Revoke',
      revealKeyPrompt: 'Your new API key (only shown once):',
      revealKeyWarning: 'Store this key safely. It cannot be shown again once you leave this page.',
      quickstartTitle: 'Quick Integration Guide for Cursor / Cline',
      quickstartDesc: 'Set the following configuration in your AI IDE settings:',

      // Subpage Models
      modelsPageTitle: 'Model Catalog & Daily Pricing',
      modelsPageSubtitle: 'Use the Model ID in Cursor, Cline, or code — Morphic automatically routes to the fastest upstream provider.',
      modelsSearchPlaceholder: 'Search model or provider...',
      filterAllCap: 'All Capabilities',
      modelStatusReady: 'Ready',
      dailyRateLabel: 'Daily Estimate:',
      curlSampleTitle: 'Example cURL Request (/v1/chat/completions)',

      // Subpage Billing
      billingPageTitle: 'Billing & Daily Passes',
      billingPageSubtitle: 'Purchase daily plans under Rp 10,000 or instant credit balance via QRIS.',
      activeBalanceLabel: 'Active Balance',
      billingPackagesTitle: 'Daily Passes & Micro Plans (< Rp 10,000)',
      scanQrisInstantBadge: 'Instant QRIS Scan',
      duration24h: '24-Hour Pass',
      flexibleDuration: 'Flexible',
      buyPackageBtn: 'Buy Package',
      activePassesTitle: 'Your Active Daily Passes',
      activeStatusBadge: 'Active',
      expiresPrefix: 'Expires:',
      qrisHistoryTitle: 'QRIS Payment History',
      noPaymentsHistory: 'No payment transactions recorded yet.',

      // Subpage Voucher / Redeem
      redeemPageTitle: 'Redeem Voucher Code',
      redeemPageSubtitle: 'Enter a promotional or developer voucher code to claim free credits or a package.',
      voucherCardTitle: 'Have a Coupon or Gift Code?',
      voucherCardDesc: 'Free credits will be added to your Morphic account immediately upon verification.',
      voucherInputLabel: 'VOUCHER CODE',
      voucherInputPlaceholder: 'e.g. MORPHIC-DEV-2026',
      redeemSubmitBtn: 'Redeem Now',
      redeemingBtn: 'Verifying...',
      termsCardTitle: 'Voucher Terms & Guidelines',
      termItem1: 'Each promotional voucher code can only be claimed once per account.',
      termItem2: 'Claimed credits activate immediately across all coding and reasoning models.',
      termItem3: 'No credit card or recurring monthly commitments required.',

      // Subpage Usage
      usagePageTitle: 'Usage & Token Analytics',
      usagePageSubtitle: 'Monitor your credit token consumption and AI model invocations in real-time.',
      usageToday: 'Today',
      usageThisMonth: 'This Month',
      usageTotalRequests: 'Total Requests',
      usageCreditsUnit: 'credits',
      usageAllTimeUnit: 'all time',
      usageByModelTitle: 'Usage by Model',
      usageRecentTitle: 'Recent Invocations Activity',
      thUsageModel: 'Model',
      thUsageCredits: 'Credits',
      thUsageRequests: 'Requests',
      thUsageTokens: 'Tokens',
      thUsageLatency: 'Latency',
      thUsageTime: 'Time',
      noUsageHistory: 'No API calls recorded yet. Start sending prompts from Cursor or Cline!',
      signOut: 'Sign Out',
    },
  },
};

export type TranslationDictionary = {
  nav: {
    models: string;
    integration: string;
    features: string;
    faq: string;
    login: string;
    getStarted: string;
    dashboard: string;
  };
  hero: {
    badge: string;
    headline: string;
    headlineSub: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    manageKeys: string;
  };
  terminal: {
    badge: string;
    title: string;
    desc: string;
    copy: string;
    copied: string;
    testing: string;
    connected: string;
  };
  steps: {
    badge: string;
    title: string;
    desc: string;
    step1Num: string;
    step1Title: string;
    step1Desc: string;
    step1Badge: string;
    step2Num: string;
    step2Title: string;
    step2Desc: string;
    step2Badge: string;
    step3Num: string;
    step3Title: string;
    step3Desc: string;
    step3Badge: string;
    step4Num: string;
    step4Title: string;
    step4Desc: string;
    step4Badge: string;
    footerNote: string;
    ctaLoggedIn: string;
    ctaGuest: string;
  };
  problemSolution: {
    badge: string;
    title: string;
    desc: string;
    problemLabel: string;
    solutionLabel: string;
    card1Problem: string;
    card1ProblemDesc: string;
    card1Solution: string;
    card1SolutionDesc: string;
    card2Problem: string;
    card2ProblemDesc: string;
    card2Solution: string;
    card2SolutionDesc: string;
    card3Problem: string;
    card3ProblemDesc: string;
    card3Solution: string;
    card3SolutionDesc: string;
    card4Problem: string;
    card4ProblemDesc: string;
    card4Solution: string;
    card4SolutionDesc: string;
  };
  models: {
    badge: string;
    title: string;
    desc: string;
    searchPlaceholder: string;
    filterAll: string;
    filterCoding: string;
    filterReasoning: string;
    filterChat: string;
    filterMultimodal: string;
    priceLabel: string;
    speedLabel: string;
    contextLabel: string;
    useModel: string;
    viewAllModels: string;
    modelsCount: string;
    noResults: string;
    memberPricingBadge: string;
    memberPricingTitle: string;
    memberPricingDesc: string;
    memberPricingPerk1: string;
    memberPricingPerk2: string;
    memberPricingPerk3: string;
    memberPricingBtnGuest: string;
    memberPricingBtnMember: string;
    memberPricingCaption: string;
  };
  cta: {
    badge: string;
    title: string;
    desc: string;
    getStartedBtn: string;
    viewModelsBtn: string;
  };
  login: {
    backHome: string;
    title: string;
    subtitle: string;
    googleBtn: string;
    githubBtn: string;
    keyOption: string;
    keyTitle: string;
    keyPlaceholder: string;
    keySubmit: string;
    keyCancel: string;
    alreadyLoggedIn: string;
    goToDashboard: string;
    switchAccount: string;
    termsNotice: string;
  };
  faq: {
    badge: string;
    title: string;
    desc: string;
  };
  footer: {
    rights: string;
    tagline: string;
    morphicSub: string;
  };
  dashboard: {
    consoleBadge: string;
    title: string;
    desc: string;
    nodeStatus: string;
    intelligenceRouterActive: string;
    failoverGateway: string;
    failoverDesc: string;
    latency: string;
    burstLimit: string;
    upstream: string;
    online: string;
    gatewayNodes: string;
    region: string;
    active: string;
    serverlessEndpoint: string;
    openAiCompatible: string;
    copy: string;
    copied: string;
    baseUrlDesc: string;
    creditBalance: string;
    live: string;
    creditsDesc: string;
    topUpQris: string;
    dailyPackages: string;
    fromPrice: string;
    packagesDesc: string;
    activeKeys: string;
    keysActiveCount: string;
    keysDesc: string;
    modelCatalog: string;
    modelsCount: string;
    modelsDesc: string;
    packagesBadge: string;
    packagesTitle: string;
    packagesSubtitle: string;
    yourBalance: string;
    selected: string;
    buyQris: string;
    voucherTitle: string;
    voucherSubtitle: string;
    claim: string;
    voucherPlaceholder: string;
    checkoutQris: string;
    scanQrisDesc: string;
    confirmPayment: string;
    paymentSuccess: string;
    keysSectionTitle: string;
    keysSectionDesc: string;
    chatCompletionsCompatible: string;
    multipleKeysSupport: string;
    newKeyLabel: string;
    newKeyPlaceholder: string;
    creatingKey: string;
    createKey: string;
    yourKeysList: string;
    justNow: string;
    today: string;
    catalogBadge: string;
    catalogTitle: string;
    catalogDesc: string;
    searchPlaceholder: string;
    capabilities: string;
    activeModelsSuffix: string;
    dailyEstimate: string;
    context: string;
    navOverview: string;
    navKeys: string;
    navModels: string;
    navBilling: string;
    navVoucher: string;
    navUsage: string;
    balanceLabel: string;
    refreshBalance: string;
    copyBaseUrl: string;
    allCapabilities: string;
    openAiCompatibleBadge: string;

    // Subpage Keys
    keysPageTitle: string;
    keysPageSubtitle: string;
    createKeyBtn: string;
    creatingKeyBtn: string;
    keyNameInputPlaceholder: string;
    noKeysFound: string;
    thName: string;
    thKey: string;
    thStatus: string;
    thLastUsed: string;
    thCreated: string;
    thAction: string;
    revokeBtn: string;
    revealKeyPrompt: string;
    revealKeyWarning: string;
    quickstartTitle: string;
    quickstartDesc: string;

    // Subpage Models
    modelsPageTitle: string;
    modelsPageSubtitle: string;
    modelsSearchPlaceholder: string;
    filterAllCap: string;
    modelStatusReady: string;
    dailyRateLabel: string;
    curlSampleTitle: string;

    // Subpage Billing
    billingPageTitle: string;
    billingPageSubtitle: string;
    activeBalanceLabel: string;
    billingPackagesTitle: string;
    scanQrisInstantBadge: string;
    duration24h: string;
    flexibleDuration: string;
    buyPackageBtn: string;
    activePassesTitle: string;
    activeStatusBadge: string;
    expiresPrefix: string;
    qrisHistoryTitle: string;
    noPaymentsHistory: string;

    // Subpage Voucher / Redeem
    redeemPageTitle: string;
    redeemPageSubtitle: string;
    voucherCardTitle: string;
    voucherCardDesc: string;
    voucherInputLabel: string;
    voucherInputPlaceholder: string;
    redeemSubmitBtn: string;
    redeemingBtn: string;
    termsCardTitle: string;
    termItem1: string;
    termItem2: string;
    termItem3: string;

    // Subpage Usage
    usagePageTitle: string;
    usagePageSubtitle: string;
    usageToday: string;
    usageThisMonth: string;
    usageTotalRequests: string;
    usageCreditsUnit: string;
    usageAllTimeUnit: string;
    usageByModelTitle: string;
    usageRecentTitle: string;
    thUsageModel: string;
    thUsageCredits: string;
    thUsageRequests: string;
    thUsageTokens: string;
    thUsageLatency: string;
    thUsageTime: string;
    noUsageHistory: string;
    signOut: string;
  };
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationDictionary;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  t: TRANSLATIONS.en,
});

export function LanguageProvider({
  children,
  initialLocale = 'en',
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('morphic_locale') as Locale | null;
      if (saved === 'id' || saved === 'en') {
        if (saved !== initialLocale) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLocaleState(saved);
        }
        document.cookie = `morphic_locale=${saved}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // LocalStorage unavailable
    }
  }, [initialLocale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('morphic_locale', newLocale);
      document.cookie = `morphic_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // LocalStorage unavailable
    }
  };

  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
