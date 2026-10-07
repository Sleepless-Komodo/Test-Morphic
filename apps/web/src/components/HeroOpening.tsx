'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import AnimatedText from '@/components/AnimatedText';

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
  hidden: { opacity: 0, y: 22, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export default function HeroOpening({ isLoggedIn = false }: HeroOpeningProps) {
  const { t, locale } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotionSafe();

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.defaultMuted = true;
      video.muted = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, []);

  const headline1 = t?.hero?.headline || (locale === 'id' ? 'Satu Kunci API' : 'One Single API Key');
  const headline2 =
    t?.hero?.headlineSub || (locale === 'id' ? 'untuk Semua Model AI Terbaik.' : 'for the Best AI Models.');
  const subheadline = t.hero.subheadline;

  return (
    <section
      ref={sectionRef}
      className="hero-section relative w-full overflow-hidden flex flex-col items-center justify-center min-h-[92vh] sm:min-h-screen pt-36 sm:pt-44 md:pt-48 pb-24 sm:pb-32 bg-[#fafafa] text-neutral-900"
    >
      {/* 1. Concentric Circles Video Animation (Inverted & Grayscaled to Morphic Monochrome Palette) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0"
        aria-hidden="true"
      >
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none mix-blend-multiply opacity-40 filter invert grayscale contrast-125 scale-105"
        >
          <source src="/concentric-circles.mp4" type="video/mp4" />
          <source
            src="https://cdn.jiro.build/Velara/the-purple-neon-concentric-circles-pulse-and-radia.mp4"
            type="video/mp4"
          />
        </video>

        {/* Soft radial vignette mask so rings are centered behind headline and fade at edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 75% 65% at 50% 45%, transparent 35%, rgba(250, 250, 250, 0.75) 70%, #fafafa 100%)',
          }}
        />

        {/* Seamless bottom fade into page body */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fafafa] to-transparent pointer-events-none" />
      </div>

      {/* 2. Main Foreground Hero Content (Industry Standard max-w-7xl) */}
      <motion.div
        initial={reduced ? false : 'hidden'}
        animate="visible"
        variants={containerVariants}
        className="relative z-10 max-w-7xl mx-auto w-full flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8 my-auto"
      >
        {/* Grand Headline (Flagship scale, confident high-contrast typography) */}
        <h1
          suppressHydrationWarning
          className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.25rem] xl:text-[5.75rem] font-extrabold tracking-tight leading-[1.04] max-w-4xl sm:max-w-5xl mx-auto mb-6 sm:mb-8 font-heading transform-gpu text-balance"
        >
          <motion.span variants={itemVariants} className="block text-neutral-950">
            {headline1}
          </motion.span>
          <motion.span
            variants={itemVariants}
            className="block text-neutral-400 font-bold mt-2 sm:mt-3"
          >
            {headline2}
          </motion.span>
        </h1>

        {/* Concise Subheadline Paragraph */}
        <motion.p
          suppressHydrationWarning
          variants={itemVariants}
          className="text-neutral-600 font-body text-base sm:text-lg md:text-xl lg:text-[1.3rem] leading-relaxed mb-10 sm:mb-12 max-w-2xl sm:max-w-3xl mx-auto font-normal text-balance"
        >
          {subheadline}
        </motion.p>

        {/* Dual Action CTA Buttons with Interactive Roll-up Micro-interaction */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 w-full sm:w-auto"
        >
          {/* Primary Button — Solid black with white roll-up text */}
          <Link
            href={isLoggedIn ? '/dashboard/keys' : '/login'}
            className="group w-full sm:w-auto min-w-[220px] sm:min-w-[250px] justify-center rounded-full px-9 sm:px-11 py-4 sm:py-4.5 text-base sm:text-lg font-bold flex items-center gap-2.5 btn-hero-primary cursor-pointer text-center shadow-sm"
          >
            <AnimatedText
              text={
                isLoggedIn
                  ? t?.hero?.manageKeys || (locale === 'id' ? 'Kelola API Key' : 'Manage Keys')
                  : t?.hero?.primaryCta || (locale === 'id' ? 'Dapatkan API Key' : 'Get API Key')
              }
              className="text-white"
            />
            <ArrowUpRight className="h-5 w-5 sm:h-5.5 sm:w-5.5 shrink-0 btn-hero-icon transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          {/* Secondary Button — Clean white surface with dark roll-up text */}
          <Link
            href="/models"
            className="group w-full sm:w-auto min-w-[200px] sm:min-w-[230px] justify-center rounded-full px-9 sm:px-11 py-4 sm:py-4.5 text-base sm:text-lg font-bold flex items-center gap-2.5 btn-hero-secondary cursor-pointer text-center shadow-2xs"
          >
            <AnimatedText
              text={t?.hero?.secondaryCta || (locale === 'id' ? 'Jelajahi Model' : 'Explore Models')}
              className="text-neutral-900 group-hover:text-black"
            />
          </Link>
        </motion.div>

      </motion.div>
    </section>
  );
}
