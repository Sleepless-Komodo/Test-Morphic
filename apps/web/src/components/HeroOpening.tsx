'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import ParallaxBackground from '@/components/ParallaxBackground';

interface HeroOpeningProps {
  isLoggedIn?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export default function HeroOpening({ isLoggedIn = false }: HeroOpeningProps) {
  const { t, locale } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotionSafe();

  const fallbackSubheadline =
    locale === 'id'
      ? 'Akses Claude 3.5, DeepSeek V4, Qwen, dan Kimi tanpa ribet kartu kredit internasional. Hemat biaya token hingga 70% dengan pembayaran QRIS lokal instan.'
      : 'Access Claude 3.5, DeepSeek V4, Qwen and Kimi without international credit card friction. Save up to 70% with instant local QRIS top-up.';

  const headline1 = t?.hero?.headline || (locale === 'id' ? 'Satu Kunci API' : 'One Single API Key');
  const headline2 = t?.hero?.headlineSub || (locale === 'id' ? 'untuk Semua Model AI Terbaik.' : 'for the Best AI Models.');
  const subheadline = t?.hero?.subheadline || fallbackSubheadline;

  return (
    <section
      ref={sectionRef}
      className="hero-section relative w-full overflow-x-clip flex flex-col items-center justify-center min-h-[85vh] sm:min-h-[90vh] pt-32 sm:pt-40 md:pt-44 pb-32 sm:pb-40 md:pb-48"
    >
      {/* Parallax visual background — blends seamlessly into #fafafa */}
      <ParallaxBackground sectionRef={sectionRef} />

      {/* Foreground — Grand Centered Developer Hero with Orchestrated Stagger Entrance */}
      <motion.div
        initial={reduced ? false : 'hidden'}
        animate="visible"
        variants={containerVariants}
        className="relative z-10 max-w-5xl mx-auto w-full flex flex-col items-center justify-center text-center px-4 sm:px-6 my-auto"
      >
        {/* 1. Badge */}
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-white/95 border border-neutral-200/90 text-neutral-900 text-xs sm:text-sm md:text-base font-semibold mb-6 shadow-2xs"
        >
          <Sparkles className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-neutral-950 shrink-0" />
          <span suppressHydrationWarning>
            {t?.hero?.badge || (locale === 'id' ? 'Satu API untuk Berbagai Model AI' : 'One API for Multiple AI Models')}
          </span>
        </motion.div>

        {/* 2. Grand Headline (100% Original Text, Line-by-Line Stagger Reveal) */}
        <h1
          suppressHydrationWarning
          className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.75rem] font-extrabold tracking-tight leading-[1.08] max-w-4xl mx-auto mb-6 font-heading transform-gpu"
        >
          <motion.span
            variants={itemVariants}
            className="block text-neutral-950"
          >
            {headline1}
          </motion.span>
          <motion.span
            variants={itemVariants}
            className="block text-neutral-500 font-bold mt-1.5 sm:mt-2.5"
          >
            {headline2}
          </motion.span>
        </h1>

        {/* 3. Subheadline Paragraph */}
        <motion.p
          suppressHydrationWarning
          variants={itemVariants}
          className="text-neutral-700 font-body text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed mb-8 sm:mb-10 max-w-3xl mx-auto font-medium"
        >
          {subheadline}
        </motion.p>

        {/* 4. Action Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4.5 w-full sm:w-auto"
        >
          <Link
            href={isLoggedIn ? '/dashboard/keys' : '/login'}
            className="w-full sm:w-auto min-w-[210px] sm:min-w-[230px] justify-center rounded-full px-8 sm:px-9 py-3.5 sm:py-4 text-sm sm:text-base md:text-lg font-bold flex items-center gap-2.5 btn-hero-primary cursor-pointer text-center shadow-sm"
          >
            <span suppressHydrationWarning>
              {isLoggedIn ? t?.hero?.manageKeys : (t?.hero?.primaryCta || 'Get API Key')}
            </span>
            <ArrowUpRight className="h-4.5 w-4.5 sm:h-5 sm:w-5 shrink-0 btn-hero-icon" />
          </Link>
          <Link
            href="/models"
            className="w-full sm:w-auto min-w-[190px] sm:min-w-[210px] justify-center rounded-full px-8 sm:px-9 py-3.5 sm:py-4 text-sm sm:text-base md:text-lg font-bold flex items-center gap-2.5 btn-hero-secondary cursor-pointer text-center shadow-2xs"
          >
            <span suppressHydrationWarning>
              {t?.hero?.secondaryCta || 'Explore Models'}
            </span>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
