'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface LandingApiCtaProps {
  isLoggedIn?: boolean;
}

/**
 * Parametric Funnel Lattice Visual
 * Recreates LangChain's iconic converging wireframe lattice funnel,
 * rendered in Morphic's crisp monochrome vector dots and precision laser beam.
 */
function ConvergingLatticeFunnel() {
  const dots = useMemo(() => {
    const items: Array<{ x: number; y: number; r: number; opacity: number; key: string }> = [];
    const rings = 26;
    const strands = 18;

    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      const x = 20 + t * 400; // x-axis from 20 to 420
      // Radius narrows exponentially towards the neck
      const radius = 175 * Math.pow(1 - t, 1.45) + 3.5;
      const ringOpacity = 0.3 + 0.7 * Math.pow(t, 0.7);

      for (let s = 0; s < strands; s++) {
        const angle = s * ((2 * Math.PI) / strands) + i * 0.16;
        const y = 200 + radius * Math.sin(angle);
        const z = Math.cos(angle); // 3D depth [-1, 1]
        const depthFactor = (z + 1) / 2; // [0, 1]
        const dotRadius = 1.0 + 1.6 * depthFactor;
        const dotOpacity = (0.2 + 0.8 * depthFactor) * ringOpacity;

        items.push({
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          r: Math.round(dotRadius * 10) / 10,
          opacity: Math.round(dotOpacity * 100) / 100,
          key: `${i}-${s}`,
        });
      }
    }
    return items;
  }, []);

  return (
    <div className="relative w-full max-w-[480px] aspect-[5/4] sm:aspect-[4/3] flex items-center justify-center select-none pointer-events-none mx-auto lg:mx-0">
      <svg
        viewBox="0 0 520 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden="true"
      >
        {/* Converging mesh dots */}
        {dots.map((d) => (
          <circle key={d.key} cx={d.x} cy={d.y} r={d.r} fill="#09090b" opacity={d.opacity} />
        ))}

        {/* Laser beam focusing out towards the content */}
        <line
          x1="418"
          y1="200"
          x2="520"
          y2="200"
          stroke="#09090b"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Focal node pulse at beam convergence */}
        <circle cx="420" cy="200" r="4.5" fill="#09090b" opacity="0.85" />
        <circle cx="420" cy="200" r="1.5" fill="#fafafa" />
      </svg>
    </div>
  );
}

export default function LandingApiCta({ isLoggedIn = false }: LandingApiCtaProps) {
  const { t, locale } = useTranslation();
  const reduced = useReducedMotionSafe();

  return (
    <section
      id="keunggulan"
      className="relative z-10 py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 bg-[#fafafa]"
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: EASE }}
        className="mx-auto max-w-6xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Parametric Lattice Mesh converging to a focal laser beam (LangChain-style visual, unboxed) */}
          <div className="lg:col-span-6 w-full flex items-center justify-center lg:justify-start">
            <ConvergingLatticeFunnel />
          </div>

          {/* Right Column: Heading, LangChain-style Buttons, Description & Trust Note (Unboxed open layout) */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            {/* Eyebrow Badge */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs font-mono font-medium text-neutral-700 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="tracking-[0.16em] uppercase font-bold text-[10px]">
                {locale === 'id' ? 'TANPA KARTU KREDIT · QRIS INSTAN' : 'NO CARD · INSTANT QRIS'}
              </span>
            </div>

            {/* Big Editorial Headline */}
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 leading-[1.1]">
              {locale === 'id' ? (
                <>
                  Semua model, satu key.
                  <span className="block text-neutral-500 font-semibold">Mulai coding hari ini.</span>
                </>
              ) : (
                <>
                  Every model, one key.
                  <span className="block text-neutral-500 font-semibold">Start shipping today.</span>
                </>
              )}
            </h2>

            {/* Action Buttons Row (Unified rounded-full pill buttons) */}
            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Link
                href={isLoggedIn ? '/dashboard/keys' : '/login'}
                className="group relative inline-flex items-center justify-center gap-2.5 h-12 px-6 sm:px-7 rounded-full bg-neutral-950 hover:bg-neutral-900 active:bg-black text-white text-sm sm:text-base font-semibold shadow-xs transition-all duration-200 ease-out hover:shadow-md active:scale-[0.99] cursor-pointer text-center"
              >
                <span>{isLoggedIn ? (locale === 'id' ? 'Kelola API Key' : 'Manage Keys') : t.cta.getStartedBtn}</span>
                <ArrowUpRight className="w-4 h-4 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href="/models"
                className="group relative inline-flex items-center justify-center gap-2.5 h-12 px-6 sm:px-7 rounded-full bg-white hover:bg-neutral-100 active:bg-neutral-200 text-neutral-900 border border-neutral-300 hover:border-neutral-950 text-sm sm:text-base font-semibold transition-all duration-200 ease-out active:scale-[0.99] cursor-pointer text-center shadow-2xs"
              >
                <span>{t.cta.viewModelsBtn}</span>
                <ArrowUpRight className="w-4 h-4 shrink-0 text-neutral-500 group-hover:text-neutral-900 transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            {/* Subtitle / Paragraph Description underneath buttons (LangChain sequence) */}
            <p className="mt-5 max-w-xl text-sm sm:text-base text-neutral-600 leading-relaxed font-body">
              {t.cta.desc}
            </p>

            {/* Monochrome single-line trust note */}
            <div className="mt-7 pt-5 border-t border-neutral-200 text-[11px] font-mono text-neutral-500 w-full">
              {locale === 'id'
                ? 'Pembayaran QRIS instan · Hingga 180 RPM · Kompatibel format OpenAI SDK'
                : 'Instant QRIS payment · Up to 180 RPM · OpenAI SDK compatible'}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
