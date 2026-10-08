'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { Plus } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface BillingFaqItem {
  q: { id: string; en: string };
  a: { id: string; en: string };
}

const BILLING_FAQS: BillingFaqItem[] = [
  {
    q: {
      id: 'Apakah saldo kuota kredit memiliki masa kedaluwarsa?',
      en: 'Do purchased credit balances have an expiration date?',
    },
    a: {
      id: 'Tidak ada kedaluwarsa sama sekali. Saldo kredit yang Anda beli di Morphic aktif selamanya dan tidak akan pernah hangus, bahkan jika Anda tidak menggunakannya selama berbulan-bulan.',
      en: 'No expiration date whatsoever. Purchased credits in Morphic remain active forever and never expire, even if unused for months.',
    },
  },
  {
    q: {
      id: 'Metode pembayaran apa saja yang didukung oleh Morphic?',
      en: 'What payment methods are supported by Morphic?',
    },
    a: {
      id: 'Kami mendukung QRIS nasional otomatis. Anda bisa membayar menggunakan m-Banking (BCA, Mandiri, BNI, BRI, CIMB, Permata, dll) maupun dompet digital e-wallet (GoPay, OVO, Dana, ShopeePay, LinkAja). Saldo masuk otomatis dalam 3-5 detik.',
      en: 'We support instant national QRIS. Pay easily via local m-Banking (BCA, Mandiri, BNI, BRI, etc.) or popular e-wallets (GoPay, OVO, Dana, ShopeePay). Balance is credited automatically in 3-5 seconds.',
    },
  },
  {
    q: {
      id: 'Apakah ada biaya langganan bulanan atau biaya tersembunyi?',
      en: 'Are there any monthly subscription commitments or hidden fees?',
    },
    a: {
      id: 'Tidak ada biaya langganan bulanan. Sistem kami 100% Pay-As-You-Go: Anda hanya membayar saat Anda melakukan top-up kuota kredit, tanpa kartu kredit internasional dan tanpa komitmen biaya rutin.',
      en: 'No monthly subscription fees. Morphic is strictly Pay-As-You-Go: you only pay when topping up credits, without foreign credit card friction and zero recurring commitments.',
    },
  },
  {
    q: {
      id: 'Bagaimana cara kerja Pass Harian (Daily Pass)?',
      en: 'How does the 24-Hour Daily Pass work?',
    },
    a: {
      id: 'Pass Harian (mulai Rp 2.500) memberikan akses penggunaan unlimited untuk model AI pilihan Anda selama 24 jam penuh sejak waktu aktivasi. Sangat ideal untuk sesi sprint coding atau hackathon tanpa memikirkan token.',
      en: 'Daily Passes (starting from Rp 2,500) grant unlimited access to a selected AI model for a full 24-hour window from activation. Perfect for intense coding sprints or hackathons.',
    },
  },
  {
    q: {
      id: 'Apakah saya bisa mengunduh invoice resmi untuk reimburse kantor?',
      en: 'Can I download official digital invoices for corporate reimbursement?',
    },
    a: {
      id: 'Ya, setiap transaksi top-up QRIS otomatis menghasilkan invoice digital dan bukti bayar resmi lengkap dengan nomor referensi transaksi yang dapat Anda unduh dari dashboard billing kapan saja.',
      en: 'Yes, every QRIS top-up transaction automatically generates a downloadable digital invoice and receipt with transaction reference IDs from your billing dashboard.',
    },
  },
  {
    q: {
      id: 'Apa yang terjadi jika kuota kredit saya habis di tengah coding?',
      en: 'What happens if my credits run out while coding in IDE?',
    },
    a: {
      id: 'Jika saldo habis, endpoint akan merespons dengan pesan error HTTP 402 yang informatif tanpa merusak konfigurasi IDE Anda. Dashboard juga menyediakan peringatan saat saldo menyentuh batas minimum.',
      en: 'If credits deplete, the gateway returns a safe HTTP 402 status without breaking your IDE configuration. You can easily top-up via QRIS in 5 seconds to resume instantly.',
    },
  },
];

export default function PricingFaq() {
  const { locale } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const spring = { type: 'spring' as const, stiffness: 380, damping: 34 };
  const highlight = hovered ?? openIndex;
  const shown = (openIndex ?? 0) + 1;

  const title =
    locale === 'en'
      ? 'Frequently asked questions on billing'
      : 'Pertanyaan seputar saldo & pembayaran';
  const desc =
    locale === 'en'
      ? 'Everything you need to know about QRIS top-ups, credit validity, and corporate invoices.'
      : 'Informasi lengkap seputar masa aktif kuota, pembayaran instan QRIS, dan bukti transaksi resmi.';

  return (
    <section id="faq" className="relative z-10 bg-white scroll-mt-20 border-t border-neutral-200/80">
      <span id="billing-faq" className="sr-only scroll-mt-20 block" />
      <div className="px-5 sm:px-8 py-20 lg:py-28 text-neutral-950">
        <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          {/* Sticky Left Editorial Header */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: EASE }}
            className="lg:sticky lg:top-32"
          >
            <h2 suppressHydrationWarning className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-balance">
              {title}
            </h2>
            <p suppressHydrationWarning className="mt-4 max-w-sm text-base leading-relaxed text-neutral-600">
              {desc}
            </p>

            {/* Large rolling index */}
            <div className="mt-10 hidden items-end gap-3 lg:flex" aria-hidden="true">
              <span className="relative inline-flex h-[5.5rem] overflow-hidden font-heading text-[5.5rem] font-extrabold leading-none tracking-tight tabular-nums">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={shown}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.55, ease: EASE }}
                  >
                    {String(shown).padStart(2, '0')}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="mb-2 font-mono text-sm text-neutral-400">/ {String(BILLING_FAQS.length).padStart(2, '0')}</span>
            </div>
          </motion.div>

          {/* Right Column Accordion List */}
          <ul onMouseLeave={() => setHovered(null)} className="flex flex-col gap-1">
            {BILLING_FAQS.map((faq, idx) => {
              const isOpen = openIndex === idx;
              const question = faq.q[locale] || faq.q.en || faq.q.id;
              const answer = faq.a[locale] || faq.a.en || faq.a.id;
              const panelId = `billing-faq-panel-${idx}`;

              return (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.6, delay: idx * 0.06, ease: EASE }}
                  onMouseEnter={() => setHovered(idx)}
                  className="relative rounded-2xl"
                >
                  {highlight === idx && (
                    <motion.span
                      layoutId="billing-faq-highlight"
                      aria-hidden="true"
                      className={`absolute inset-0 rounded-2xl transition-colors duration-300 ${isOpen ? 'bg-neutral-950' : 'bg-neutral-100'}`}
                      transition={spring}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="relative flex w-full items-center justify-between gap-5 rounded-2xl px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 cursor-pointer"
                  >
                    <span className="flex min-w-0 items-baseline gap-4">
                      <span className="shrink-0 font-mono text-sm tabular-nums transition-colors duration-300 text-neutral-400">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span
                        suppressHydrationWarning
                        className={`text-lg font-semibold tracking-tight transition-colors duration-300 ${isOpen ? 'text-white' : 'text-neutral-900'}`}
                      >
                        {question}
                      </span>
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={spring}
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors duration-300 ${
                        isOpen ? 'border-white bg-white text-neutral-950' : 'border-neutral-300 text-neutral-600'
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={panelId}
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: EASE }}
                        className="relative overflow-hidden"
                      >
                        <p suppressHydrationWarning className="px-5 pb-6 pl-[3.25rem] text-[15px] leading-relaxed text-neutral-300">
                          {answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
