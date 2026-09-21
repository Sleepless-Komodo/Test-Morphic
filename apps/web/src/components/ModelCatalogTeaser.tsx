'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_MODELS, getModelDailyRate, getModelBadge } from '@/lib/models-data';
import { ModelProviderLogo } from './ProviderLogos';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import { ArrowUpRight, ChevronRight, Bot } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

export default function ModelCatalogTeaser({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const { t, locale } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reduced = useReducedMotionSafe();

  const teaserModels = ALL_MODELS.slice(0, 4);
  const activeModel = teaserModels[selectedIndex] || teaserModels[0];

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % teaserModels.length);
  };

  return (
    <section
      id="models"
      className="relative z-10 py-14 lg:py-20 px-6 bg-[#fafafa] text-neutral-900 border-t border-neutral-200/70 scroll-mt-20 sm:scroll-mt-24 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
        >
          <div>
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono uppercase tracking-[0.2em] text-neutral-500 font-bold mb-3">
              <Bot className="w-3.5 h-3.5 text-neutral-900" />
              <span>{t.models.badge}</span>
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold tracking-tight text-neutral-950">
              {t.models.title}
            </h2>
            <p className="mt-4 text-neutral-600 font-body text-base sm:text-lg leading-relaxed max-w-2xl">
              {t.models.desc}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <Link
              href="/models"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 hover:border-neutral-950 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transition-all hover:bg-neutral-950 hover:text-white shadow-2xs group"
            >
              <span>{locale === 'en' ? `View all ${ALL_MODELS.length} models` : `Lihat semua ${ALL_MODELS.length} model`}</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </motion.div>

        {/* Master-Detail Split Grid */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
          className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-start"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Left Column: Interactive Model Selector List */}
          <div className="divide-y divide-neutral-200 border-t border-b border-neutral-200">
            {teaserModels.map((model, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={model.id}
                  onClick={() => setSelectedIndex(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  aria-label={`Select model ${model.name}`}
                  className={`group relative flex items-center justify-between py-5 sm:py-6 px-3 sm:px-4 text-left transition-all duration-200 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'bg-neutral-100/70 text-neutral-950 shadow-2xs translate-x-1 sm:translate-x-2'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 hover:translate-x-1'
                  }`}
                >
                  {/* Selection indicator line */}
                  {isSelected && (
                    <motion.span
                      layoutId="activeModelIndicator"
                      className="absolute inset-x-0 -bottom-px h-[2.5px] bg-neutral-950 z-10 rounded-full"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}

                  <div className="flex items-baseline gap-3.5 sm:gap-4.5 min-w-0 pr-4">
                    <span
                      className={`font-mono text-xs tabular-nums transition-colors ${
                        isSelected
                          ? 'text-neutral-950 font-extrabold scale-105'
                          : 'text-neutral-500 group-hover:text-neutral-700'
                      }`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xl sm:text-2xl font-heading font-bold tracking-tight truncate transition-transform group-hover:translate-x-0.5">
                        {model.name}
                      </span>
                      <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-neutral-500 font-semibold mt-0.5">
                        {model.provider}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 sm:gap-4 shrink-0">
                    <span className="font-mono text-xs sm:text-sm text-neutral-600 font-semibold hidden sm:inline">
                      {getModelDailyRate(model, locale)}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${
                        isSelected
                          ? 'border-neutral-950 bg-neutral-950 text-white shadow-xs scale-105 rotate-45'
                          : 'border-neutral-200 text-neutral-500 group-hover:border-neutral-400 group-hover:text-neutral-900 group-hover:rotate-45'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Model Showcase Card */}
          <div
            className="relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.08)]"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeModel.id}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.98 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="flex flex-col h-full"
              >
                {/* Provider Logo + Badge + Model Switch Hint */}
                <div className="flex items-center justify-between gap-4">
                  <div className="h-14 w-14 rounded-2xl border border-neutral-200 bg-neutral-50 flex items-center justify-center p-2.5 shadow-2xs transition-transform hover:scale-105">
                    <ModelProviderLogo provider={activeModel.provider} className="h-8 w-8" />
                  </div>
                  <div className="flex items-center gap-2">
                    {getModelBadge(activeModel, locale) && (
                      <span className="px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.18em] uppercase border border-neutral-950 bg-neutral-950 text-white shadow-2xs">
                        {getModelBadge(activeModel, locale)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight text-neutral-950">
                      {activeModel.name}
                    </h3>
                    {/* Quick next model button */}
                    <button
                      onClick={handleNext}
                      className="text-xs font-mono text-neutral-600 hover:text-neutral-950 flex items-center gap-1 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                      title={locale === 'en' ? 'Next Model' : 'Model Berikutnya'}
                      aria-label={locale === 'en' ? 'Next Model' : 'Model Berikutnya'}
                    >
                      <span>{locale === 'en' ? 'Next' : 'Berikutnya'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="font-mono text-[11px] tracking-wider text-neutral-500 mt-1">
                    {activeModel.id}
                  </p>
                </div>

                <p className="mt-4 text-xs sm:text-sm text-neutral-600 font-body leading-relaxed min-h-[44px]">
                  {activeModel.description[locale] || activeModel.description.id}
                </p>

                {/* Price & Context spec boxes */}
                <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-neutral-100">
                  <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-3.5 hover:border-neutral-300 transition-colors">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">
                      {t.models.priceLabel}
                    </p>
                    <p className="mt-1 font-mono text-base sm:text-lg font-bold text-neutral-900">
                      {getModelDailyRate(activeModel, locale)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-3.5 hover:border-neutral-300 transition-colors">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">
                      {t.models.contextLabel}
                    </p>
                    <p className="mt-1 font-mono text-base sm:text-lg font-bold text-neutral-900">
                      {activeModel.contextWindow}
                    </p>
                  </div>
                </div>

                {/* Routing Status via Morphic */}
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-neutral-50 border border-neutral-200/80 px-4 py-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase font-bold text-neutral-600">
                    {locale === 'en' ? 'READY · ROUTED VIA MORPHIC' : 'READY · TERHUBUNG VIA MORPHIC'}
                  </span>
                </div>

                {/* Action CTA */}
                <Link
                  href={isLoggedIn ? '/dashboard/keys' : '/login'}
                  className="mt-5 w-full py-3.5 px-4 rounded-2xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs group/btn"
                >
                  <span>{t.models.useModel}</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
