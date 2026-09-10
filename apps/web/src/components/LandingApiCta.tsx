'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { ArrowUpRight } from 'lucide-react';

interface LandingApiCtaProps {
  isLoggedIn?: boolean;
}

export default function LandingApiCta({ isLoggedIn = false }: LandingApiCtaProps) {
  const { t, locale } = useTranslation();

  return (
    <section id="keunggulan" className="relative z-10 py-20 px-4 sm:px-6 bg-white text-neutral-900">
      <div className="max-w-5xl mx-auto">
        <div className="group relative rounded-3xl border border-neutral-200 bg-[#fafafa] p-8 sm:p-14 text-center overflow-hidden transition-all duration-300 hover:border-neutral-300 hover:shadow-[0_16px_40px_-18px_rgba(9,9,11,0.15)]">
          {/* Subtle top light */}
          <div
            className="absolute inset-x-0 top-0 h-40 pointer-events-none"
            style={{
              background:
                'radial-gradient(60% 100% at 50% 0%, rgba(9,9,11,0.04) 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-bold mb-5">
              {t.cta.badge}
            </div>

            <h2 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight mb-4 text-neutral-950">
              {t.cta.title}
            </h2>

            <p className="text-neutral-600 font-body text-sm sm:text-base mb-9 leading-relaxed">
              {t.cta.desc}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={isLoggedIn ? '/dashboard/keys' : '/login'}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
              >
                <span>{isLoggedIn ? t.hero.manageKeys : t.cta.getStartedBtn}</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
              <Link
                href="/models"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white border border-neutral-300 hover:border-neutral-950 text-neutral-900 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs hover:-translate-y-0.5 cursor-pointer"
              >
                <span>{t.cta.viewModelsBtn}</span>
              </Link>
            </div>

            {/* Single-line trust info, monochrome */}
            <div className="mt-9 pt-6 border-t border-neutral-200/80 text-[11px] font-mono text-neutral-500">
              {locale === 'id'
                ? 'Pembayaran QRIS instan · Hingga 180 RPM · Kompatibel OpenAI SDK'
                : 'Instant QRIS payment · Up to 180 RPM · OpenAI SDK compatible'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
