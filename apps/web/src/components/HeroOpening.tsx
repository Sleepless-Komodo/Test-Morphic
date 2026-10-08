'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import AnimatedText from '@/components/AnimatedText';
import HeroContours from '@/components/HeroContours';

interface HeroOpeningProps {
  isLoggedIn?: boolean;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};

// Each word rises out of its own clipped line box.
const wordVariants = {
  hidden: { y: '110%' },
  visible: { y: '0%', transition: { duration: 0.9, ease: EASE } },
};

const fadeVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

function Words({ text, className }: { text: string; className: string }) {
  return (
    <span className={`block ${className}`}>
      {text.split(' ').map((word, i) => (
        <span key={`${word}-${i}`}>
          {i > 0 && ' '}
          <span className="inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-bottom">
            <motion.span variants={wordVariants} className="inline-block will-change-transform">
              {word}
            </motion.span>
          </span>
        </span>
      ))}
    </span>
  );
}

export default function HeroOpening({ isLoggedIn = false }: HeroOpeningProps) {
  const { t, locale } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll: the stage recedes as a card while the copy lifts and the contours sink (depth).
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const progress = useSpring(
    scrollYProgress,
    isMobile
      ? { stiffness: 130, damping: 30, restDelta: 0.002 }
      : { stiffness: 200, damping: 40 }
  );
  const stageScale = useTransform(progress, [0, 1], [1, 0.92]);
  const copyY = useTransform(progress, [0, 1], [0, -180]);
  const copyOpacity = useTransform(progress, [0, 0.55], [1, 0]);
  const fieldY = useTransform(progress, [0, 1], [0, 140]);

  const headline1 = t?.hero?.headline || (locale === 'id' ? 'Satu Kunci API' : 'One Single API Key');
  const headline2 =
    t?.hero?.headlineSub || (locale === 'id' ? 'untuk Semua Model AI Terbaik.' : 'for the Best AI Models.');
  const subheadline = t.hero.subheadline;

  return (
    <section ref={sectionRef} className="hero-section relative w-full bg-[#fafafa] p-2 sm:p-3">
      <motion.div
        style={{ scale: stageScale }}
        className="relative isolate flex min-h-[calc(100svh-16px)] sm:min-h-[calc(100svh-24px)] items-center overflow-hidden rounded-[24px] sm:rounded-[32px] bg-[#0a0a0a] text-white origin-top will-change-transform"
      >
        <motion.div aria-hidden="true" style={{ y: fieldY }} className="absolute inset-0 -z-10">
          <HeroContours className="h-full w-full" />
        </motion.div>
        {/* Stage light from above. White only: the brand is monochrome. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(ellipse 70% 55% at 50% -8%, rgba(255,255,255,0.13), transparent 70%)' }}
        />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 sm:px-6 pt-28 sm:pt-32 pb-20 sm:pb-24 text-center"
        >
          <motion.div style={{ y: copyY, opacity: copyOpacity }} className="flex flex-col items-center">
            <h1
              suppressHydrationWarning
              className="font-heading text-[2.6rem] sm:text-6xl md:text-7xl lg:text-[4.75rem] font-extrabold tracking-tight leading-[1.02] mb-5 sm:mb-6 text-balance max-w-5xl"
            >
              <Words key={`h1-${headline1}`} text={headline1} className="text-white" />
              <Words key={`h2-${headline2}`} text={headline2} className="text-neutral-500 font-bold mt-1 sm:mt-2" />
            </h1>

            <motion.p
              suppressHydrationWarning
              variants={fadeVariants}
              className="text-neutral-400 font-body text-base sm:text-lg leading-relaxed mb-8 max-w-2xl text-balance"
            >
              {subheadline}
            </motion.p>

            <motion.div
              variants={fadeVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto"
            >
              <Link
                href={isLoggedIn ? '/dashboard/keys' : '/login'}
                className="group w-full sm:w-auto min-w-[210px] justify-center rounded-full bg-white px-7 py-3.5 text-base font-bold text-neutral-950 flex items-center gap-2 transition-[background-color,transform] duration-300 hover:bg-neutral-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                <AnimatedText
                  text={
                    isLoggedIn
                      ? t?.hero?.manageKeys || (locale === 'id' ? 'Kelola API Key' : 'Manage Keys')
                      : t?.hero?.primaryCta || (locale === 'id' ? 'Dapatkan API Key' : 'Get API Key')
                  }
                />
                <ArrowUpRight className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>

              <Link
                href="/models"
                className="group w-full sm:w-auto min-w-[190px] justify-center rounded-full border border-white/20 px-7 py-3.5 text-base font-bold text-white flex items-center transition-[background-color,border-color,transform] duration-300 hover:bg-white/10 hover:border-white/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                <AnimatedText text={t?.hero?.secondaryCta || (locale === 'id' ? 'Jelajahi Model' : 'Explore Models')} />
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
