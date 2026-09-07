'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { KeyRound, ArrowUpRight, ShieldCheck, Zap, Sparkles } from 'lucide-react';

interface LandingApiCtaProps {
  isLoggedIn?: boolean;
}

export default function LandingApiCta({ isLoggedIn = false }: LandingApiCtaProps) {
  const { t } = useTranslation();

  return (
    <section id="keunggulan" className="relative z-10 py-20 px-4 sm:px-6 bg-white text-neutral-900 border-t border-neutral-200/90">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-neutral-300/90 bg-neutral-50/50 p-8 sm:p-12 shadow-sm text-center relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-radial from-neutral-200/40 via-transparent to-transparent opacity-50 pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-neutral-200 text-neutral-800 text-xs font-semibold mb-5 shadow-xs">
              <KeyRound className="h-3.5 w-3.5 text-neutral-950" />
              <span>{t.cta.badge}</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight mb-4 text-neutral-950">
              {t.cta.title}
            </h2>

            <p className="text-neutral-600 font-body text-sm sm:text-base mb-8 leading-relaxed">
              {t.cta.desc}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={isLoggedIn ? '/dashboard/keys' : '/login'}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:scale-[1.02] cursor-pointer"
              >
                <span>{isLoggedIn ? t.hero.manageKeys : t.cta.getStartedBtn}</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                href="/models"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-900 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs hover:scale-[1.02] cursor-pointer"
              >
                <span>{t.cta.viewModelsBtn}</span>
              </Link>
            </div>

            {/* Micro badges below CTA */}
            <div className="mt-8 pt-6 border-t border-neutral-200/80 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500 font-mono">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Instant QRIS Setup</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Up to 180 RPM Concurrency</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Drop-in OpenAI Standard</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
