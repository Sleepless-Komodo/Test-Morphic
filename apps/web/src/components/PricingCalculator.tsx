'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface ModelRate {
  id: string;
  name: string;
  provider: string;
  logo: string;
  officialRatePerMillion: number; // in IDR equivalent with valas card fee
  morphicRatePerMillion: number; // in IDR
}

const MODELS_DATA: ModelRate[] = [
  {
    id: 'deepseek-v4',
    name: 'DeepSeek V4',
    provider: 'DeepSeek',
    logo: '/logos/deepseek-color.svg',
    officialRatePerMillion: 8500,
    morphicRatePerMillion: 2500,
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    provider: 'Alibaba Cloud',
    logo: '/logos/qwen-color.svg',
    officialRatePerMillion: 42000,
    morphicRatePerMillion: 13000,
  },
  {
    id: 'kimi-coding',
    name: 'Kimi Coding',
    provider: 'Moonshot AI',
    logo: '/logos/kimi-color.svg',
    officialRatePerMillion: 38000,
    morphicRatePerMillion: 12000,
  },
  {
    id: 'MiniMaxAI/MiniMax-M2.7',
    name: 'MiniMax M2.7',
    provider: 'MiniMax',
    logo: '/logos/minimax-color.svg',
    officialRatePerMillion: 28000,
    morphicRatePerMillion: 8000,
  },
  {
    id: 'DeepSeek-V4-Flash-0731',
    name: 'DeepSeek V4 Flash',
    provider: 'DeepSeek',
    logo: '/logos/deepseek-color.svg',
    officialRatePerMillion: 6500,
    morphicRatePerMillion: 2000,
  },
];

const PRESETS = [
  { label: '500K', labelEn: '500K', value: 0.5 },
  { label: '2 Juta', labelEn: '2M', value: 2 },
  { label: '10 Juta', labelEn: '10M', value: 10 },
  { label: '30 Juta', labelEn: '30M', value: 30 },
  { label: '80 Juta', labelEn: '80M', value: 80 },
];

/** Smooth rolling price component matching Morphic PricingPlans */
function RollingNumber({ value, locale }: { value: number; locale: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) =>
    new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Math.round(v)),
  );

  useEffect(() => {
    const c = animate(mv, value, { duration: 0.65, ease: EASE });
    return () => c.stop();
  }, [value, mv]);

  return <motion.span className="tabular-nums">{text}</motion.span>;
}

export default function PricingCalculator() {
  const { locale } = useTranslation();
  const en = locale === 'en';

  const [selectedModelId, setSelectedModelId] = useState<string>('deepseek-v4');
  const [tokensMillions, setTokensMillions] = useState<number>(10);

  const selectedModel = MODELS_DATA.find((m) => m.id === selectedModelId) || MODELS_DATA[0];

  const officialCost = Math.round(tokensMillions * selectedModel.officialRatePerMillion);
  const morphicCost = Math.round(tokensMillions * selectedModel.morphicRatePerMillion);
  const savings = officialCost - morphicCost;
  const savingsPercent = Math.round((savings / officialCost) * 100);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <section className="relative z-10 py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[#fafafa] border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.55, ease: EASE }}
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
        >
          <p suppressHydrationWarning className="mb-3 text-sm font-medium text-neutral-500">
            {en ? 'Interactive Cost Calculator' : 'Kalkulator Simulasi Penghematan'}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold tracking-tight text-neutral-950 text-balance">
            {en ? 'Calculate Your Monthly Token Savings' : 'Bandingkan Biaya Token Morphic vs Provider Resmi'}
          </h2>
          <p className="mt-4 text-neutral-600 font-body text-base sm:text-lg leading-relaxed max-w-2xl mx-auto text-balance">
            {en
              ? 'See in real-time how much you save by switching to Morphic unified QRIS gateway without foreign credit card surcharges.'
              : 'Simulasikan kebutuhan token bulanan Anda. Bebas biaya konversi valas, tanpa deposit minimum kartu kredit USD, dan hemat hingga 70%.'}
          </p>
        </motion.div>

        {/* Bento Console: 2 Columns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch"
        >
          {/* Left Panel: Inputs & Configuration */}
          <div className="lg:col-span-7 rounded-[26px] border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-8">
            {/* 1. Model Selector */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                  {en ? '1. Select AI Model' : '1. Pilih Model AI'}
                </span>
                <span className="font-mono text-[11px] text-neutral-400">OpenAI Compatible</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MODELS_DATA.map((model) => {
                  const isSelected = selectedModelId === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModelId(model.id)}
                      aria-pressed={isSelected}
                      className={`group relative flex items-center gap-3 rounded-2xl p-3 text-left transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border border-neutral-950 bg-neutral-950 text-white shadow-xs'
                          : 'border border-neutral-200 bg-neutral-50/50 text-neutral-900 hover:border-neutral-300 hover:bg-neutral-100/70'
                      }`}
                    >
                      <div
                        className={`relative h-9 w-9 shrink-0 rounded-xl grid place-items-center transition-colors ${
                          isSelected ? 'bg-white/10' : 'bg-white border border-neutral-200/80 shadow-2xs'
                        }`}
                      >
                        <Image
                          src={model.logo}
                          alt={model.provider}
                          width={20}
                          height={20}
                          unoptimized
                          className="h-5 w-5 object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1 pr-1">
                        <div
                          className={`text-sm font-semibold truncate leading-snug ${
                            isSelected ? 'text-white' : 'text-neutral-950'
                          }`}
                        >
                          {model.name}
                        </div>
                        <div
                          className={`text-[11px] font-mono truncate ${
                            isSelected ? 'text-neutral-400' : 'text-neutral-500'
                          }`}
                        >
                          {model.provider}
                        </div>
                      </div>

                      {isSelected && (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-neutral-950 shrink-0">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Token Volume Slider & Presets */}
            <div className="space-y-4 pt-2 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                  {en ? '2. Monthly Token Usage' : '2. Estimasi Token / Bulan'}
                </span>
                <span className="font-mono text-sm sm:text-base font-extrabold text-neutral-950 bg-neutral-100 px-3 py-1 rounded-xl tabular-nums">
                  {en ? `${tokensMillions}M Tokens` : `${tokensMillions} Juta Token`}
                </span>
              </div>

              {/* Slider Input with Custom Track */}
              <div className="relative py-2">
                <input
                  type="range"
                  id="monthly-token-slider"
                  aria-label={en ? 'Monthly token usage estimation in millions' : 'Estimasi penggunaan token bulanan'}
                  min={0.5}
                  max={100}
                  step={0.5}
                  value={tokensMillions}
                  onChange={(e) => setTokensMillions(parseFloat(e.target.value))}
                  className="w-full h-2.5 bg-neutral-200/80 rounded-full appearance-none cursor-pointer accent-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-mono text-neutral-400 mr-0.5">Preset:</span>
                {PRESETS.map((preset) => {
                  const isActive = tokensMillions === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setTokensMillions(preset.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${
                        isActive
                          ? 'bg-neutral-950 text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-950'
                      }`}
                    >
                      {en ? preset.labelEn : preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: The Morphic Ledger Card */}
          <div className="lg:col-span-5 rounded-[26px] border border-white/10 bg-[#0a0a0a] p-6 sm:p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-[0_24px_60px_-20px_rgba(10,10,10,0.55)]">
            {/* Ambient Radial Glare */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(255,255,255,0.12), transparent 70%)',
              }}
            />

            {/* Header: Brand & Savings Badge */}
            <div className="relative flex items-center justify-between pb-6 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="relative h-7 w-7 overflow-hidden rounded-lg">
                  <Image src="/morphic-symbol.jpg" alt="" fill sizes="28px" className="object-cover scale-[1.9]" />
                </span>
                <span className="font-mono text-xs tracking-wider uppercase text-neutral-300">SAVINGS LEDGER</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-bold text-white border border-white/15 tabular-nums">
                <Sparkles className="w-3 h-3 text-neutral-300" />
                {en ? `Save ${savingsPercent}%` : `Hemat ${savingsPercent}%`}
              </span>
            </div>

            {/* Hero Metric: Big Rolling Savings */}
            <div className="relative py-6 my-auto">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-2">
                {en ? 'Estimated Monthly Savings' : 'Estimasi Penghematan Bulanan'}
              </div>
              <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-white tabular-nums">
                <RollingNumber value={savings} locale={locale} />
              </div>
              <div className="mt-2 text-xs text-neutral-400">
                {en ? 'Net savings retained in Rupiah' : 'Selisih dana yang Anda hemat per bulan'}
              </div>
            </div>

            {/* Architectural Itemized Ledger Breakdown */}
            <div className="relative space-y-3 pt-6 border-t border-white/10 text-xs">
              {/* Row 1: Direct USD Provider */}
              <div className="flex items-center justify-between text-neutral-400">
                <div className="flex flex-col">
                  <span>{en ? 'Direct Official Provider' : 'Provider Resmi (USD)'}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {en ? 'USD rate + ~3% bank FX surcharge' : 'Kurs valas + fee kartu kredit ~3%'}
                  </span>
                </div>
                <div className="font-mono text-sm line-through text-neutral-500 tabular-nums">
                  {formatRupiah(officialCost)}
                </div>
              </div>

              {/* Row 2: Morphic QRIS Gateway */}
              <div className="flex items-center justify-between text-white font-medium">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    <span>Morphic AI Gateway</span>
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono pl-3">
                    {en ? 'Direct QRIS · 0% FX fees' : 'QRIS instan · Tanpa kartu kredit'}
                  </span>
                </div>
                <div className="font-mono text-base font-bold text-white tabular-nums">
                  {formatRupiah(morphicCost)}
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="relative pt-6 mt-6 border-t border-white/10">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 px-5 text-sm font-semibold text-neutral-950 transition-all duration-200 hover:bg-neutral-200 active:scale-[0.98] shadow-sm group"
              >
                <span>{en ? 'Start Free with QRIS' : 'Mulai Top-up QRIS'}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
