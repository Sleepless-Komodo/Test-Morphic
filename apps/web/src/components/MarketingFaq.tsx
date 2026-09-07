'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

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

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="relative z-10 py-20 px-4 sm:px-6 bg-[#fafafa] text-neutral-900 border-t border-neutral-200/90">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-semibold mb-4 shadow-sm">
            <HelpCircle className="h-3.5 w-3.5 text-neutral-900" />
            <span suppressHydrationWarning>{t.faq.badge}</span>
          </div>

          <h2 suppressHydrationWarning className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight mb-3 text-neutral-950">
            {t.faq.title}
          </h2>

          <p suppressHydrationWarning className="text-neutral-600 font-body text-sm sm:text-base leading-relaxed">
            {t.faq.desc}
          </p>
        </div>

        {/* Accordion list */}
        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const question = faq.q[locale] || faq.q.en || faq.q.id;
            const answer = faq.a[locale] || faq.a.en || faq.a.id;

            return (
              <div
                key={idx}
                className="rounded-2xl border border-neutral-200/90 bg-white overflow-hidden transition-all duration-200 hover:border-neutral-300 shadow-xs"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 hover:bg-neutral-50/70 cursor-pointer transition-colors"
                >
                  <span suppressHydrationWarning className="font-heading font-bold text-base sm:text-lg text-neutral-950">
                    {question}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-neutral-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-neutral-950' : ''
                      }`}
                  />
                </button>

                {isOpen && (
                  <div suppressHydrationWarning className="px-5 sm:px-6 pb-6 text-xs sm:text-sm text-neutral-600 font-body leading-relaxed border-t border-neutral-100 pt-4 bg-white">
                    {answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
