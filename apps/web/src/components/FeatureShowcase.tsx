'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import { Lock } from 'lucide-react';
import {
  OpenAILogo,
  ClaudeLogo,
  DeepSeekLogo,
  QwenLogo,
  KimiLogo,
  ZhipuLogo,
  YiLogo,
} from '@/components/ProviderLogos';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Visual 1: Raised Provider Keycaps Matrix (Row 1, Col 1)
 */
function ProviderKeycapsVisual() {
  const keys = [
    { name: 'Claude', Logo: ClaudeLogo },
    { name: 'OpenAI', Logo: OpenAILogo },
    { name: 'DeepSeek', Logo: DeepSeekLogo },
    { name: 'Qwen', Logo: QwenLogo },
    { name: 'Kimi', Logo: KimiLogo },
    { name: 'Zhipu', Logo: ZhipuLogo },
  ];

  return (
    <div className="relative w-full h-[190px] sm:h-[210px] flex items-center justify-center select-none overflow-hidden p-4" aria-hidden="true">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {keys.map(({ name, Logo }) => (
          <div
            key={name}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white border border-neutral-200/90 shadow-2xs flex flex-col items-center justify-center p-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs group"
            title={name}
          >
            <Logo className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:scale-105" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Visual 2: Zero Data Retention & AES Vault Spec (Row 1, Col 2)
 */
function SecurityPolicyVisual({ locale }: { locale: string }) {
  return (
    <div className="relative w-full h-[190px] sm:h-[210px] flex items-center justify-center select-none px-4" aria-hidden="true">
      <div className="w-full max-w-[270px] rounded-2xl bg-neutral-950 p-4 border border-neutral-800 shadow-md font-mono text-[11px] text-neutral-300 space-y-2">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-neutral-200">
            <Lock className="w-3 h-3 text-neutral-400" />
            Zero-Retention
          </span>
          <span className="text-neutral-500">AES-256</span>
        </div>
        <div className="space-y-1.5 pt-0.5 text-[10px] sm:text-[11px]">
          <div className="flex justify-between">
            <span className="text-neutral-500">payload_storage:</span>
            <span className="text-neutral-200 font-medium">EPHEMERAL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">model_training:</span>
            <span className="text-neutral-200 font-medium">OPT_OUT_100%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">key_vault:</span>
            <span className="text-neutral-200 font-medium">ISOLATED</span>
          </div>
        </div>
        <div className="pt-2 border-t border-neutral-800 flex items-center gap-1.5 text-[10px] text-neutral-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>{locale === 'id' ? 'Nol prompt disimpan di disk' : 'Zero prompts stored on disk'}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Visual 3: Live SSE Stream Token Output (Row 1, Col 3)
 */
function StreamTokensVisual() {
  return (
    <div className="relative w-full h-[190px] sm:h-[210px] flex items-center justify-center select-none px-4" aria-hidden="true">
      <div className="w-full max-w-[270px] rounded-2xl bg-white border border-neutral-200/90 p-3.5 shadow-2xs font-mono text-[11px] space-y-2">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-2 text-[10px] text-neutral-500">
          <span className="flex items-center gap-1.5 font-semibold text-neutral-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SSE Stream
          </span>
          <span className="text-neutral-400">TTFT &lt; 15ms</span>
        </div>
        <div className="space-y-1.5 py-0.5 text-neutral-700 leading-relaxed text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">chunk #01</span>
            <span className="text-neutral-900 font-medium">const client =</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">chunk #02</span>
            <span className="text-neutral-900 font-medium">new OpenAI(&#123;</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">chunk #03</span>
            <span className="text-neutral-900 font-medium">baseURL, apiKey</span>
          </div>
        </div>
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
          <span>Tokens: 142/s</span>
          <span className="text-neutral-600 font-medium">180 RPM</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Visual 4: IDE Drop-In Config Window (Row 2, Col 1 - 50% wide)
 */
function IdeDropinVisual() {
  return (
    <div className="relative w-full h-[180px] sm:h-[200px] flex flex-col justify-center items-center gap-3 select-none px-4" aria-hidden="true">
      {/* IDE Logos badges */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 shadow-2xs text-xs font-mono font-semibold text-neutral-800">
          <Image src="/logos/cursor.svg" alt="Cursor" width={16} height={16} unoptimized className="w-4 h-4" />
          <span>Cursor</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 shadow-2xs text-xs font-mono font-semibold text-neutral-800">
          <Image src="/logos/cline.svg" alt="Cline" width={16} height={16} unoptimized className="w-4 h-4" />
          <span>Cline</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 shadow-2xs text-xs font-mono font-semibold text-neutral-800">
          <Image src="/logos/windsurf.svg" alt="Windsurf" width={16} height={16} unoptimized className="w-4 h-4" />
          <span>Windsurf</span>
        </div>
      </div>
      {/* Config snippet box */}
      <div className="w-full max-w-[340px] rounded-xl bg-neutral-950 p-3.5 border border-neutral-800 shadow-inner font-mono text-[11px] text-neutral-300">
        <div><span className="text-neutral-500">{'// Standard OpenAI Configuration'}</span></div>
        <div className="mt-1">
          <span className="text-neutral-400">&quot;baseURL&quot;: </span>
          <span className="text-neutral-200">&quot;https://api.morphic.sh/v1&quot;</span>
        </div>
        <div>
          <span className="text-neutral-400">&quot;apiKey&quot;: </span>
          <span className="text-neutral-200">&quot;mp-live-xxxxxx&quot;</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Visual 5: Floating Provider Mesh & Auto-Failover (Row 2, Col 2 - 50% wide)
 */
function FailoverMeshVisual({ locale }: { locale: string }) {
  const providers = [
    { name: 'OpenAI', Logo: OpenAILogo },
    { name: 'Claude', Logo: ClaudeLogo },
    { name: 'DeepSeek', Logo: DeepSeekLogo },
    { name: 'Qwen', Logo: QwenLogo },
    { name: 'Kimi', Logo: KimiLogo },
    { name: 'GLM', Logo: ZhipuLogo },
    { name: 'Yi', Logo: YiLogo },
  ];

  return (
    <div className="relative w-full h-[180px] sm:h-[200px] flex items-center justify-center select-none overflow-hidden px-4" aria-hidden="true">
      {/* Dotted canvas backdrop */}
      <div
        className="absolute inset-0 opacity-35 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="relative z-10 grid grid-cols-4 gap-2 sm:gap-2.5 max-w-[340px] w-full">
        {providers.map(({ name, Logo }, i) => (
          <div
            key={name}
            className={`rounded-2xl bg-white border border-neutral-200/90 p-2 sm:p-2.5 shadow-2xs flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs group ${
              i === 6 ? 'col-span-2' : ''
            }`}
          >
            <Logo className="w-5 h-5 transition-transform group-hover:scale-105" />
            <span className="font-mono text-[9px] font-bold text-neutral-600 truncate max-w-full">
              {name}
            </span>
          </div>
        ))}
        <div className="rounded-2xl bg-neutral-50/90 border border-neutral-200/80 p-2 sm:p-2.5 shadow-2xs flex flex-col items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[8px] font-bold uppercase text-neutral-500 tracking-wider text-center">
            {locale === 'id' ? 'RUTE AKTIF' : 'ACTIVE ROUTE'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function FeatureShowcase() {
  const { t, locale } = useTranslation();
  const reduced = useReducedMotionSafe();

  const stats = [
    { value: t.showcase.stat1Value, label: t.showcase.stat1Label },
    { value: t.showcase.stat2Value, label: t.showcase.stat2Label },
    { value: t.showcase.stat3Value, label: t.showcase.stat3Label },
    { value: t.showcase.stat4Value, label: t.showcase.stat4Label },
  ];

  return (
    <section id="gateway" className="relative z-10 px-4 sm:px-6 py-24 lg:py-32 overflow-hidden bg-[#fafafa] scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-center max-w-3xl mx-auto mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center px-3.5 py-1 rounded-xl border border-neutral-200 bg-white text-xs font-mono uppercase tracking-[0.2em] text-neutral-500 font-bold mb-5 shadow-2xs">
            {t.showcase.badge}
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-950 font-heading mb-5">
            {t.showcase.title}
          </h2>
          <p className="text-neutral-600 font-body text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            {t.showcase.desc}
          </p>
        </motion.div>

        {/* Master Asymmetric Grid Container (Laravel AI style 3 + 2 layout with crosshairs) */}
        <div className="relative border border-neutral-200 bg-white rounded-3xl overflow-hidden shadow-xs">
          {/* ── ROW 1: 3 Columns (Visual on top, Text on bottom) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-200 border-b border-neutral-200">
            {/* Col 1: Multi-Provider Routing */}
            <div className="flex flex-col justify-between">
              <div className="border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-center">
                <ProviderKeycapsVisual />
              </div>
              <div className="p-7 sm:p-8 flex flex-col justify-start">
                <h3 className="text-lg font-bold text-neutral-950 font-heading mb-2 leading-snug">
                  {t.showcase.card0Title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 font-body leading-relaxed">
                  {t.showcase.card0Desc}
                </p>
              </div>
            </div>

            {/* Col 2: Zero Retention & Encryption */}
            <div className="flex flex-col justify-between">
              <div className="border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-center">
                <SecurityPolicyVisual locale={locale} />
              </div>
              <div className="p-7 sm:p-8 flex flex-col justify-start">
                <h3 className="text-lg font-bold text-neutral-950 font-heading mb-2 leading-snug">
                  {t.showcase.card6Title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 font-body leading-relaxed">
                  {t.showcase.card6Desc}
                </p>
              </div>
            </div>

            {/* Col 3: SSE Streaming & Concurrency */}
            <div className="flex flex-col justify-between">
              <div className="border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-center">
                <StreamTokensVisual />
              </div>
              <div className="p-7 sm:p-8 flex flex-col justify-start">
                <h3 className="text-lg font-bold text-neutral-950 font-heading mb-2 leading-snug">
                  {t.showcase.card2Title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 font-body leading-relaxed">
                  {t.showcase.card2Desc}
                </p>
              </div>
            </div>
          </div>

          {/* ── ROW 2: 2 Columns 50% - 50% (Inverted Cadence: Text on top, Visual on bottom) ── */}
          <div className="relative grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200 border-b border-neutral-200">
            {/* Top row crosshair intersections */}
            <span className="hidden md:flex absolute top-0 left-1/3 -translate-x-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm font-light select-none pointer-events-none z-20">
              +
            </span>
            <span className="hidden md:flex absolute top-0 left-2/3 -translate-x-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm font-light select-none pointer-events-none z-20">
              +
            </span>

            {/* Col 1 (50% wide): 100% OpenAI Format Compatible */}
            <div className="flex flex-col justify-between">
              <div className="p-7 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-neutral-950 font-heading mb-2 leading-snug">
                  {t.showcase.card1Title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 font-body leading-relaxed">
                  {t.showcase.card1Desc}
                </p>
              </div>
              <div className="border-t border-neutral-100 bg-neutral-50/40 flex items-center justify-center">
                <IdeDropinVisual />
              </div>
            </div>

            {/* Col 2 (50% wide): Automatic Multi-Provider Failover */}
            <div className="flex flex-col justify-between">
              <div className="p-7 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-neutral-950 font-heading mb-2 leading-snug">
                  {t.showcase.card7Title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 font-body leading-relaxed">
                  {t.showcase.card7Desc}
                </p>
              </div>
              <div className="border-t border-neutral-100 bg-neutral-50/40 flex items-center justify-center">
                <FailoverMeshVisual locale={locale} />
              </div>
            </div>
          </div>

          {/* ── ROW 3: 4-Stat Strip (Proven Factual Metrics) ── */}
          <div className="relative grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-neutral-200 lg:divide-x bg-white">
            {/* Row 2 crosshair intersection */}
            <span className="hidden md:flex absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm font-light select-none pointer-events-none z-20">
              +
            </span>

            {stats.map((stat) => (
              <div key={stat.label} className="p-7 sm:p-8 flex flex-col justify-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 font-heading">
                  {stat.value}
                </div>
                <div className="mt-2 font-mono text-[10px] sm:text-[11px] tracking-[0.18em] uppercase font-bold text-neutral-500">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
