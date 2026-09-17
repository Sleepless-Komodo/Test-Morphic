'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import { Zap, ShieldCheck } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * CAD-style hairline crosshair (+) placed at grid intersections,
 * matching the exact technical design in the reference mockup.
 */
function Crosshair({ className }: { className?: string }) {
  return (
    <div
      className={`absolute select-none pointer-events-none z-20 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="7.5" y1="0" x2="7.5" y2="15" stroke="#A3A3A3" strokeWidth="1" />
        <line x1="0" y1="7.5" x2="15" y2="7.5" stroke="#A3A3A3" strokeWidth="1" />
      </svg>
    </div>
  );
}

/**
 * Visual 1: Dotted concentric racetrack with provider chips (enlarged & spacious)
 */
function RacetrackVisual() {
  return (
    <div className="relative w-full h-[220px] sm:h-[260px] flex items-center justify-center select-none overflow-hidden" aria-hidden="true">
      {/* Concentric oval tracks */}
      <div className="absolute w-[320px] sm:w-[370px] h-[100px] sm:h-[120px] rounded-full border border-dashed border-neutral-200" />
      <div className="absolute w-[380px] sm:w-[430px] h-[140px] sm:h-[160px] rounded-full border border-dashed border-neutral-200/70" />

      {/* 4 Provider Chips */}
      <div className="relative z-10 flex items-center gap-3 sm:gap-4">
        {/* OpenAI */}
        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-center hover:scale-105 transition-transform">
          <svg className="w-6 h-6 text-neutral-900" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3428 7.897a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3428 7.897zm16.5991 3.8558L13.1038 8.3843l2.0153-1.1635a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4022-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1636a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.6069 1.4997-2.602-1.4997z"/>
          </svg>
        </div>

        {/* xAI */}
        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-center hover:scale-105 transition-transform">
          <span className="font-bold text-lg sm:text-xl text-neutral-950 font-heading">𝕏</span>
        </div>

        {/* Mistral / Jina dot logo */}
        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-center gap-1.5 hover:scale-105 transition-transform">
          <div className="w-3.5 h-3.5 rounded-full bg-[#EA4335]" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#00897B]" />
        </div>

        {/* Parallel / Pause */}
        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-center gap-2 hover:scale-105 transition-transform">
          <div className="w-1.5 h-5 rounded-full bg-neutral-950" />
          <div className="w-1.5 h-5 rounded-full bg-neutral-950" />
        </div>
      </div>
    </div>
  );
}

/**
 * Visual 2: Document / Prompt Skeleton Card with Blue Lines and Sparkle
 */
function DocumentVisual() {
  return (
    <div className="relative w-full h-[220px] sm:h-[260px] flex items-center justify-center select-none" aria-hidden="true">
      <div className="w-[210px] sm:w-[240px] rounded-xl bg-white border border-neutral-200/90 p-6 shadow-2xs space-y-3 relative">
        <div className="h-2 w-16 bg-blue-500 rounded-full" />
        <div className="h-2 w-full bg-blue-200/80 rounded-full" />
        <div className="h-2 w-4/5 bg-blue-200/80 rounded-full" />
        <div className="h-2 w-full bg-blue-300/80 rounded-full" />
        <div className="h-2 w-2/3 bg-blue-200/70 rounded-full" />

        {/* Sparkle at bottom-left */}
        <div className="pt-3">
          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Visual 3: Floating Model Chips (Staggered rows with status dots)
 */
function FloatingModelsVisual() {
  return (
    <div className="relative w-full h-[220px] sm:h-[260px] flex flex-col justify-center items-center gap-3.5 select-none overflow-hidden px-4" aria-hidden="true">
      {/* Row 1 */}
      <div className="flex items-center gap-2.5 -translate-x-2">
        <span className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/50 text-blue-700 font-mono text-xs font-semibold whitespace-nowrap shadow-2xs">
          Seek V3
        </span>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50/50 text-purple-700 font-mono text-xs font-semibold whitespace-nowrap shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-purple-600" />
          Gemini 1.5 Pro
        </span>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50/50 text-teal-700 font-mono text-xs font-semibold whitespace-nowrap shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-teal-600" />
          Llama 3.3 70B
        </span>
      </div>

      {/* Row 2 (offset) */}
      <div className="flex items-center gap-2.5 translate-x-2">
        <span className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/60 text-amber-800 font-mono text-xs font-semibold whitespace-nowrap shadow-2xs">
          Qwen 2.5 Coder
        </span>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50/50 text-sky-700 font-mono text-xs font-semibold whitespace-nowrap shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-sky-600" />
          Llama 3.3 70B
        </span>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50/50 text-purple-700 font-mono text-xs font-semibold whitespace-nowrap shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-purple-600" />
          Gemini 1.5
        </span>
      </div>
    </div>
  );
}

/**
 * FeatureShowcase — Clean 3-Column CAD Bento Grid with 4-Stat Strip
 * Designed precisely according to the user's provided mockup with generous breathing room.
 */
export default function FeatureShowcase() {
  const { t, locale } = useTranslation();
  const reduced = useReducedMotionSafe();

  const pillars = [
    {
      visual: <RacetrackVisual />,
      icon: Zap,
      title: locale === 'id' ? 'Multi-Provider Routing Cerdas' : 'Smart Multi-Provider Routing',
      desc:
        locale === 'id'
          ? 'Secara otomatis mengarahkan permintaan ke cluster instance upstream tercepat (Claude, DeepSeek, Qwen, Kimi) dengan failover otomatis tanpa downtime.'
          : 'Automatically routes requests to the fastest upstream clusters (Claude, DeepSeek, Qwen, Kimi) with zero-downtime failover.',
    },
    {
      visual: <DocumentVisual />,
      icon: ShieldCheck,
      title: locale === 'id' ? 'Zero Data Retention & Enkripsi AES' : 'Zero Data Retention & AES Encryption',
      desc:
        locale === 'id'
          ? 'Prompt dan source code Anda tidak pernah disimpan, di-cache, ataupun dijadikan data training. Kunci API Anda terenkripsi standar militer.'
          : 'Your prompts and code are never logged, cached, or trained upon. Your API credentials stay secured with military-grade encryption.',
    },
    {
      visual: <FloatingModelsVisual />,
      isCodeIcon: true,
      title: locale === 'id' ? '100% Kompatibel Format OpenAI' : '100% OpenAI Format Compatible',
      desc:
        locale === 'id'
          ? 'Dukungan penuh Server-Sent Events (SSE streaming), function calling, and multi-modal. Cukup ganti Base URL di Cursor, Cline, atau SDK resmi.'
          : 'Full support for Server-Sent Events (SSE streaming), tool calls, and vision. Just swap the Base URL in Cursor, Cline, or the official SDK.',
    },
  ];

  const stats = [
    { value: t.showcase.stat1Value, label: t.showcase.stat1Label },
    { value: t.showcase.stat2Value, label: t.showcase.stat2Label },
    { value: t.showcase.stat3Value, label: t.showcase.stat3Label },
    { value: t.showcase.stat4Value, label: t.showcase.stat4Label },
  ];

  return (
    <section id="gateway" className="relative z-10 px-4 sm:px-6 py-24 lg:py-36 overflow-hidden bg-[#fafafa] scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        {/* Section Header with Generous Breathing Room */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-center max-w-3xl mx-auto mb-16 sm:mb-20"
        >
          <div className="inline-flex items-center px-3.5 py-1 rounded border border-neutral-200 bg-white text-xs font-mono uppercase tracking-[0.2em] text-neutral-400 font-bold mb-5 shadow-2xs">
            {t.showcase.badge}
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-950 font-heading mb-5">
            {t.showcase.title}
          </h2>
          <p className="text-neutral-600 font-body text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            {t.showcase.desc}
          </p>
        </motion.div>

        {/* Master CAD Grid Container */}
        <div className="relative border border-neutral-200 bg-white shadow-2xs">
          {/* Row 1: Visual Compartments (3 Columns) */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-200 border-b border-neutral-200 bg-[#fafafa]/30">
            {/* Top Border Crosshairs */}
            <Crosshair className="top-0 left-0" />
            <Crosshair className="top-0 left-1/3" />
            <Crosshair className="top-0 left-2/3" />
            <Crosshair className="top-0 left-full" />

            {/* Bottom Border Crosshairs (Intersection between Visuals and Text) */}
            <Crosshair className="top-full left-0" />
            <Crosshair className="top-full left-1/3" />
            <Crosshair className="top-full left-2/3" />
            <Crosshair className="top-full left-full" />

            {pillars.map((pillar, i) => (
              <div key={i} className="relative flex items-center justify-center">
                {pillar.visual}
              </div>
            ))}
          </div>

          {/* Row 2: Text Feature Pillars (3 Columns - Generous Padding) */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-200">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <div key={i} className="p-9 sm:p-11 lg:p-12 flex flex-col justify-start">
                  {/* Square Icon Box */}
                  <div className="w-11 h-11 rounded-xl border border-neutral-200 bg-neutral-50/80 flex items-center justify-center mb-6 shrink-0 shadow-2xs">
                    {pillar.isCodeIcon ? (
                      <span className="font-mono text-base font-bold text-neutral-900">&gt;_</span>
                    ) : Icon ? (
                      <Icon className="w-5 h-5 text-neutral-900" />
                    ) : null}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-xl sm:text-2xl font-bold text-neutral-950 font-heading mb-3 leading-snug">
                    {pillar.title}
                  </h3>
                  <p className="text-sm sm:text-base text-neutral-600 font-body leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Row 3: 4-Stat Strip */}
          <div className="relative grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-neutral-200 lg:divide-x border-t border-neutral-200 bg-white">
            {/* Crosshairs above Stats Row */}
            <Crosshair className="top-0 left-0" />
            <Crosshair className="top-0 left-1/3 hidden md:flex" />
            <Crosshair className="top-0 left-2/3 hidden md:flex" />
            <Crosshair className="top-0 left-full" />

            {/* Crosshairs below Stats Row */}
            <Crosshair className="top-full left-0" />
            <Crosshair className="top-full left-1/4 hidden lg:flex" />
            <Crosshair className="top-full left-2/4 hidden md:flex" />
            <Crosshair className="top-full left-3/4 hidden lg:flex" />
            <Crosshair className="top-full left-full" />

            {stats.map((stat) => (
              <div key={stat.label} className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
                <div className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-950 font-heading">
                  {stat.value}
                </div>
                <div className="mt-3 font-mono text-[11px] tracking-[0.2em] uppercase font-bold text-neutral-500">
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
