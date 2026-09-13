'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import { ArrowUpRight, Zap } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface LandingApiCtaProps {
  isLoggedIn?: boolean;
}

export default function LandingApiCta({ isLoggedIn = false }: LandingApiCtaProps) {
  const { t, locale } = useTranslation();
  const reduced = useReducedMotionSafe();

  return (
    <section
      id="keunggulan"
      className="relative z-10 overflow-hidden bg-neutral-950 text-white border-t border-neutral-800"
    >
      {/* Subtle radial dot grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16, filter: 'blur(4px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.55, ease: EASE }}
        className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-24 sm:py-28 lg:py-32 text-center"
      >
        {/* Pill Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-sm px-3.5 py-1.5 shadow-2xs">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase font-bold text-neutral-300">
            {locale === 'id' ? 'TANPA KARTU KREDIT · QRIS INSTAN' : 'NO CARD · INSTANT QRIS'}
          </span>
        </div>

        {/* Big Editorial Headline */}
        <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.02] text-balance text-white max-w-2xl">
          {locale === 'id' ? (
            <>
              Coding dengan semua model,<span className="block text-neutral-400">cukup satu API key.</span>
            </>
          ) : (
            <>
              Ship with every model,<span className="block text-neutral-400">on one single key.</span>
            </>
          )}
        </h2>

        {/* Subtitle */}
        <p className="mt-5 max-w-lg text-sm sm:text-base leading-relaxed text-neutral-400 font-body">
          {t.cta.desc}
        </p>

        {/* CTA Buttons */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
          <Link
            href={isLoggedIn ? '/dashboard/keys' : '/login'}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white hover:bg-neutral-100 text-neutral-950 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group"
          >
            <span>{isLoggedIn ? t.hero.manageKeys : t.cta.getStartedBtn}</span>
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href="/models"
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>{t.cta.viewModelsBtn}</span>
          </Link>
        </div>

        {/* Monochrome single-line trust note */}
        <div className="mt-10 pt-6 border-t border-white/10 text-[11px] font-mono text-neutral-500 max-w-md">
          {locale === 'id'
            ? 'Pembayaran QRIS instan · Hingga 180 RPM · Kompatibel format OpenAI SDK'
            : 'Instant QRIS payment · Up to 180 RPM · OpenAI SDK compatible'}
        </div>
      </motion.div>
    </section>
  );
}
