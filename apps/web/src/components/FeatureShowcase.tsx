'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';
import RouterTopology from '@/components/RouterTopology';
import SpotlightCard from '@/components/SpotlightCard';
import { Zap, ShieldCheck, Terminal } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The Gateway Architecture Showcase — visual presentation of Morphic's
 * high-performance multi-provider proxy mesh with Linear/Vercel style micro blur-fade.
 */
export default function FeatureShowcase() {
  const { t, locale } = useTranslation();
  const reduced = useReducedMotionSafe();

  const pillars = [
    {
      icon: Zap,
      title: locale === 'id' ? 'Multi-Provider Routing Cerdas' : 'Smart Multi-Provider Routing',
      desc:
        locale === 'id'
          ? 'Secara otomatis mengarahkan permintaan ke cluster instance upstream tercepat (Claude, DeepSeek, Qwen, Kimi) dengan failover otomatis tanpa downtime.'
          : 'Automatically routes requests to the fastest upstream clusters (Claude, DeepSeek, Qwen, Kimi) with zero-downtime failover.',
    },
    {
      icon: ShieldCheck,
      title: locale === 'id' ? 'Zero Data Retention & Enkripsi AES' : 'Zero Data Retention & AES Encryption',
      desc:
        locale === 'id'
          ? 'Prompt dan source code Anda tidak pernah disimpan, di-cache, ataupun dijadikan data training. Kunci API Anda terenkripsi standar militer.'
          : 'Your prompts and code are never logged, cached, or trained upon. Your API credentials stay secured with military-grade encryption.',
    },
    {
      icon: Terminal,
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
    <section id="gateway" className="relative z-10 px-6 py-12 lg:py-16 overflow-hidden bg-[#fafafa] border-t border-neutral-200/70 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        {/* Section Header with Micro Blur-Fade */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-14"
        >
          <div className="text-xs sm:text-sm font-mono uppercase tracking-[0.2em] text-neutral-400 font-bold mb-3">
            {t.showcase.badge}
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-950 font-heading">
            {t.showcase.title}
          </h2>
          <p className="mt-4 text-neutral-600 font-body text-base sm:text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
            {t.showcase.desc}
          </p>
        </motion.div>

        {/* Two-Column Architecture Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-10 lg:gap-14 items-center mb-16">
          {/* Left Column: Architectural Pillars & Benefits */}
          <div className="flex flex-col gap-5">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={pillar.title}
                  initial={reduced ? false : { opacity: 0, y: 16, filter: 'blur(4px)' }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: EASE }}
                >
                  <SpotlightCard
                    spotlightColor="rgba(16, 185, 129, 0.08)"
                    className="group rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-2xs hover:border-neutral-300 hover:shadow-xs transition-all cursor-default"
                  >
                    <div className="flex items-start gap-4.5">
                      <div className="h-11 w-11 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 group-hover:bg-neutral-950 group-hover:text-white transition-colors">
                        <Icon className="h-5 w-5 text-neutral-900 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <h3 className="font-heading font-extrabold text-lg sm:text-xl text-neutral-950 mb-1.5">
                          {pillar.title}
                        </h3>
                        <p className="text-sm sm:text-base text-neutral-600 font-body leading-relaxed">
                          {pillar.desc}
                        </p>
                      </div>
                    </div>
                  </SpotlightCard>
                </motion.div>
              );
            })}
          </div>

          {/* Right Column: Interactive Router Topology Canvas */}
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, delay: 0.15, ease: EASE }}
            className="w-full flex justify-center"
          >
            <RouterTopology />
          </motion.div>
        </div>

        {/* 4-Stat Metric Grid — high-density hairline grid with staggered blur-fade */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-neutral-200/90 bg-neutral-200/90 shadow-2xs">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={reduced ? false : { opacity: 0, y: 12, filter: 'blur(4px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: EASE }}
              className="bg-white p-6 sm:p-8 hover:bg-neutral-50/50 transition-colors"
            >
              <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 font-heading">
                {stat.value}
              </p>
              <p className="mt-2.5 font-mono text-[10px] tracking-[0.18em] uppercase font-bold text-neutral-500">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
