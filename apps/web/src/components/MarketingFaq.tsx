'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import { Plus } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface FaqItem {
  q: { id: string; en: string };
  a: { id: string; en: string };
}

const FAQS: FaqItem[] = [

  {
    q: {
      id: 'Mengapa saya membutuhkan gateway API Key dari Morphic?',
      en: 'Why do I need the Morphic AI API Gateway?',
    },
    a: {
      id: 'Sebagian besar provider AI resmi mewajibkan kartu kredit internasional dengan kurs USD dan rate-limit yang ketat. Morphic menyediakan pembayaran lokal QRIS instan dalam Rupiah, endpoint tunggal OpenAI-compatible, rate limit tinggi untuk coding agent, serta saldo gabungan (Unified Credits).',
      en: 'Most official AI providers require international credit cards in USD and impose restrictive rate limits. Morphic offers instant local QRIS payments in IDR, a unified OpenAI-compatible endpoint, high burst rate limits for coding agents, and combined Unified Credits.',
    },
  },
  {
    q: {
      id: 'Bagaimana cara memasang API Key di Cursor atau Cline?',
      en: 'How do I configure my API Key in Cursor or Cline?',
    },
    a: {
      id: 'Sangat mudah! Di pengaturan Cursor atau ekstensi Cline, pilih provider "OpenAI Compatible", ubah Base URL menjadi https://api.morphic.sh/v1, dan masukkan API Key Morphic (mp-xxxx) Anda. Semua request langsung diteruskan dengan latensi rendah.',
      en: 'Super simple! In Cursor Settings or Cline extension, select "OpenAI Compatible", set the Base URL to https://api.morphic.sh/v1, and enter your Morphic API key (mp-xxxx). All requests route instantly with minimal latency.',
    },
  },
  {
    q: {
      id: 'Apakah pembayaran mendukung QRIS otomatis instan?',
      en: 'Does payment support instant automatic QRIS?',
    },
    a: {
      id: 'Ya, 100% otomatis dan instan. Anda dapat membayar menggunakan GoPay, OVO, Dana, ShopeePay, BCA Mobile, Livin Mandiri, atau aplikasi perbankan apa pun yang mendukung QRIS. Saldo aktif seketika.',
      en: 'Yes, 100% automated and instant. You can pay with GoPay, OVO, Dana, ShopeePay, BCA, Mandiri, or any QRIS-supported banking app. Your credits become available in seconds.',
    },
  },
  {
    q: {
      id: 'Apakah kode dan prompt saya aman dan privat?',
      en: 'Are my code and prompt data safe and private?',
    },
    a: {
      id: 'Morphic beroperasi sebagai proxy gateway berperforma tinggi tanpa menyimpan atau melatih ulang data prompt Anda ke pihak ketiga mana pun. Kunci API Anda dienkripsi secara aman dan Anda memiliki kendali penuh untuk mencabut (revoke) key kapan saja.',
      en: 'Morphic operates as a high-performance proxy gateway without storing or retraining on your prompts or code. Your keys are securely encrypted, and you can revoke any API key anytime from your dashboard.',
    },
  },
  {
    q: {
      id: 'Berapa banyak API Key yang bisa saya buat?',
      en: 'How many API Keys can I generate?',
    },
    a: {
      id: 'Anda bebas membuat banyak API Key dengan label terpisah (misal: "Cursor Work", "Cline Laptop", "Production") langsung melalui dashboard tanpa biaya tambahan.',
      en: 'You can generate unlimited API keys with distinct labels (e.g., "Cursor Work", "Cline Laptop", "Production") directly via your dashboard at no extra charge.',
    },
  },
];

export default function MarketingFaq() {
  const { locale, t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduced = useReducedMotionSafe();

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="relative z-10 py-14 lg:py-20 px-6 bg-[#fafafa] text-neutral-900 border-t border-neutral-200/70 scroll-mt-20 sm:scroll-mt-24">
      <div className="max-w-6xl mx-auto grid gap-12 lg:grid-cols-[0.7fr_1.3fr] items-start">
        {/* Left Column: Sticky Header */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="lg:sticky lg:top-32 lg:self-start"
        >
          <div className="text-xs sm:text-sm font-mono uppercase tracking-[0.2em] text-neutral-500 font-bold mb-3">
            {t.faq.badge}
          </div>

          <h2 suppressHydrationWarning className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold tracking-tight mb-4 text-neutral-950">
            {t.faq.title}
          </h2>

          <p suppressHydrationWarning className="text-neutral-600 font-body text-base sm:text-lg leading-relaxed max-w-sm">
            {t.faq.desc}
          </p>
        </motion.div>

        {/* Right Column: Numbered Hairline Accordion List */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
          className="border-t border-neutral-200 divide-y divide-neutral-200"
        >
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const question = faq.q[locale] || faq.q.en || faq.q.id;
            const answer = faq.a[locale] || faq.a.en || faq.a.id;

            return (
              <div
                key={idx}
                className="transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  className="w-full py-6 sm:py-7 text-left flex items-center justify-between gap-6 cursor-pointer group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
                >
                  <span className="flex items-baseline gap-4 min-w-0 pr-2">
                    <span className={`font-mono text-sm tabular-nums shrink-0 transition-colors ${isOpen ? 'text-neutral-950 font-bold' : 'text-neutral-500 group-hover:text-neutral-700'}`}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span suppressHydrationWarning className={`font-heading text-lg sm:text-xl tracking-tight transition-colors ${
                      isOpen ? 'text-neutral-950 font-bold' : 'text-neutral-800 font-semibold group-hover:text-neutral-950'
                    }`}>
                      {question}
                    </span>
                  </span>

                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-all duration-300 ${
                    isOpen
                      ? 'border-neutral-950 bg-neutral-950 text-white rotate-45 shadow-xs'
                      : 'border-neutral-200 bg-white text-neutral-500 group-hover:border-neutral-400 group-hover:text-neutral-900'
                  }`}>
                    <Plus className="h-4.5 w-4.5" />
                  </span>
                </button>

                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div suppressHydrationWarning className="pb-7 pl-8 pr-4 text-sm sm:text-base text-neutral-600 font-body leading-relaxed">
                      {answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
