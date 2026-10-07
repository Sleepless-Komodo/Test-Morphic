'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import { API_BASE_URL } from '@/lib/utils';
import { Plus } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface FaqItem {
  q: { id: string; en: string };
  a: { id: string; en: string };
}

// Every answer here is checked against the code: billing in packages/db/src/billing.ts,
// key limits in apps/api/src/routes/keys.ts, payments in apps/api/src/routes/payments.ts.
const FAQS: FaqItem[] = [
  {
    q: { id: 'Kenapa pakai Morphic, bukan langsung ke provider?', en: 'Why Morphic instead of going to each provider?' },
    a: {
      id: 'Satu API key format OpenAI untuk semua model, satu saldo, dan bayar pakai QRIS dalam Rupiah atau PayPal dalam USD. Tidak perlu akun dan kartu kredit di tiap provider.',
      en: 'One OpenAI-compatible key for every model, one balance, and you pay with QRIS in Rupiah or PayPal in USD. No separate account or card for each provider.',
    },
  },
  {
    q: { id: 'Bagaimana cara pasang di Cursor, Cline, atau SDK?', en: 'How do I set it up in Cursor, Cline or an SDK?' },
    a: {
      id: `Pilih provider "OpenAI Compatible", isi Base URL dengan ${API_BASE_URL}, lalu tempel API key Morphic Anda (mp-...). Untuk SDK OpenAI, ganti base_url saja; kode lainnya tetap sama.`,
      en: `Choose the "OpenAI Compatible" provider, set the Base URL to ${API_BASE_URL}, and paste your Morphic API key (mp-...). With an OpenAI SDK, change base_url and keep the rest of your code.`,
    },
  },
  {
    q: { id: 'Bagaimana saldo saya dipotong?', en: 'How am I charged?' },
    a: {
      id: 'Sebelum request dikirim, saldo ditahan sebesar estimasi. Setelah selesai, Anda hanya membayar token yang benar-benar terpakai, tidak pernah lebih dari estimasi, dan sisanya dikembalikan. Request yang gagal tidak dipotong sama sekali.',
      en: 'Before a request goes out, credits for an estimate are held. When it finishes you pay only for the tokens actually used, never more than the estimate, and the rest is returned. Failed requests cost nothing.',
    },
  },
  {
    q: { id: 'Bayar pakai apa?', en: 'How do I pay?' },
    a: {
      id: 'QRIS dalam Rupiah (bisa dipindai dari aplikasi bank atau e-wallet yang mendukung QRIS) atau PayPal dalam USD. Saldo masuk begitu pembayaran terkonfirmasi.',
      en: 'QRIS in Rupiah (scan it with any banking or e-wallet app that supports QRIS) or PayPal in USD. Credits are added as soon as the payment confirms.',
    },
  },
  {
    q: { id: 'Apakah prompt dan kode saya disimpan?', en: 'Do you store my prompts or code?' },
    a: {
      id: 'Tidak. Untuk tiap request kami hanya mencatat model, jumlah token, biaya, latency, dan status, supaya tagihan dan riwayat pemakaian bisa ditampilkan. Isi prompt dan respons diteruskan ke provider tanpa disimpan.',
      en: 'No. For each request we record the model, token counts, cost, latency and status, so we can bill you and show your usage. Prompt and response content is passed to the provider and not stored.',
    },
  },
  {
    q: { id: 'Berapa banyak API key yang bisa dibuat?', en: 'How many API keys can I create?' },
    a: {
      id: 'Hingga 5 key per akun. Key disimpan dalam bentuk hash, jadi key lengkap hanya tampil sekali saat dibuat. Beri nama tiap key dan revoke kapan saja dari dashboard.',
      en: 'Up to 5 per account. Keys are stored hashed, so the full key is shown once, when you create it. Name each one and revoke any of them from the dashboard.',
    },
  },
  {
    q: { id: 'Apakah streaming didukung?', en: 'Is streaming supported?' },
    a: {
      id: 'Ya. Kirim stream: true dan respons datang sebagai Server-Sent Events dalam format OpenAI, sama seperti yang sudah ditangani SDK Anda.',
      en: 'Yes. Send stream: true and the response arrives as Server-Sent Events in the OpenAI format, the same shape your SDK already handles.',
    },
  },
];

/** Answer text that resolves word by word out of a soft blur. */
function RevealText({ text, reduced }: { text: string; reduced: boolean }) {
  if (reduced) return <>{text}</>;
  return (
    <>
      {text.split(' ').map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ opacity: 0, filter: 'blur(6px)', y: 4 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 + i * 0.012, ease: EASE }}
          className="inline-block"
        >
          {w}
          {' '}
        </motion.span>
      ))}
    </>
  );
}

export default function MarketingFaq() {
  const { locale, t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const reduced = useReducedMotionSafe();
  const spring = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 380, damping: 34 };
  const highlight = hovered ?? openIndex;
  const shown = (openIndex ?? 0) + 1;

  return (
    <section id="faq" className="relative z-10 bg-white scroll-mt-20">
      <div className="px-5 sm:px-8 py-20 lg:py-28 text-neutral-950">
        <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: EASE }}
            className="lg:sticky lg:top-32"
          >
            <h2 suppressHydrationWarning className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-balance">
              {t.faq.title}
            </h2>
            <p suppressHydrationWarning className="mt-4 max-w-sm text-base leading-relaxed text-neutral-600">
              {t.faq.desc}
            </p>

            {/* Which question is open, as a large rolling index. */}
            <div className="mt-10 hidden items-end gap-3 lg:flex" aria-hidden="true">
              <span className="relative inline-flex h-[5.5rem] overflow-hidden font-heading text-[5.5rem] font-extrabold leading-none tracking-tight tabular-nums">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={shown}
                    initial={reduced ? false : { y: '100%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={reduced ? undefined : { y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.55, ease: EASE }}
                  >
                    {String(shown).padStart(2, '0')}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="mb-2 font-mono text-sm text-neutral-400">/ {String(FAQS.length).padStart(2, '0')}</span>
            </div>
          </motion.div>

          <ul onMouseLeave={() => setHovered(null)} className="flex flex-col gap-1">
            {FAQS.map((faq, idx) => {
              const isOpen = openIndex === idx;
              const question = faq.q[locale] || faq.q.en || faq.q.id;
              const answer = faq.a[locale] || faq.a.en || faq.a.id;
              const panelId = `faq-panel-${idx}`;

              return (
                <motion.li
                  key={idx}
                  initial={reduced ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.6, delay: idx * 0.06, ease: EASE }}
                  onMouseEnter={() => setHovered(idx)}
                  className="relative rounded-2xl"
                >
                  {highlight === idx && (
                    <motion.span
                      layoutId="faq-highlight"
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
                    className="relative flex w-full items-center justify-between gap-5 rounded-2xl px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
                  >
                    <span className="flex min-w-0 items-baseline gap-4">
                      <span className={`shrink-0 font-mono text-sm tabular-nums transition-colors duration-300 text-neutral-400`}>
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
                        initial={reduced ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduced ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: EASE }}
                        className="relative overflow-hidden"
                      >
                        <p suppressHydrationWarning className="px-5 pb-6 pl-[3.25rem] text-[15px] leading-relaxed text-neutral-300">
                          <RevealText key={locale} text={answer} reduced={reduced} />
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
