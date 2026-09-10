'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  QrCode,
  KeyRound,
  TerminalSquare,
  Bot,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface HowItWorksStepsProps {
  isLoggedIn?: boolean;
}

export default function HowItWorksSteps({ isLoggedIn = false }: HowItWorksStepsProps) {
  const { t, locale } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    section.classList.add('steps-js');
    const items = Array.from(section.querySelectorAll<HTMLElement>('.steps-reveal'));

    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    items.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      num: t.steps.step1Num,
      title: t.steps.step1Title,
      desc: t.steps.step1Desc,
      badge: t.steps.step1Badge,
      icon: QrCode,
      preview: (
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl border border-dashed border-neutral-300 bg-white flex items-center justify-center text-neutral-900 shrink-0 group-hover:border-neutral-400 group-hover:text-blue-600 transition-colors">
            <QrCode className="h-7 w-7" />
          </div>
          <div className="min-w-0 text-left">
            <div className="text-[11px] font-extrabold text-neutral-950 mb-0.5">Pro Agent</div>
            <div className="text-xs font-mono font-bold text-neutral-700 mb-1.5 group-hover:text-emerald-700 transition-colors">
              Rp 49.000
            </div>
            <div className="flex flex-wrap gap-1">
              {['QRIS', 'VA Bank', 'E-Wallet'].map((m) => (
                <span
                  key={m}
                  className="px-1.5 py-0.5 rounded-md bg-white border border-neutral-200 text-[9px] font-mono font-semibold text-neutral-500"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      num: t.steps.step2Num,
      title: t.steps.step2Title,
      desc: t.steps.step2Desc,
      badge: t.steps.step2Badge,
      icon: KeyRound,
      preview: (
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 font-bold mb-1.5">
            {locale === 'en' ? 'New API Key' : 'Kunci API Baru'}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-neutral-950 px-3 py-2">
            <KeyRound className="h-3.5 w-3.5 text-neutral-400 group-hover:text-white shrink-0 transition-colors" />
            <span className="font-mono text-[10px] tracking-wide text-white truncate">
              mp-live-••••••••••••
            </span>
            <Copy className="h-3 w-3 text-neutral-500 group-hover:text-neutral-300 ml-auto shrink-0 transition-colors" />
          </div>
          <div className="flex gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-[9px] font-mono font-semibold text-neutral-600">
              Cursor Work
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-[9px] font-mono font-semibold text-neutral-600">
              Production
            </span>
          </div>
        </div>
      ),
    },
    {
      num: t.steps.step3Num,
      title: t.steps.step3Title,
      desc: t.steps.step3Desc,
      badge: t.steps.step3Badge,
      icon: TerminalSquare,
      preview: (
        <div className="rounded-xl bg-white border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 font-bold shrink-0">
              Base URL
            </span>
            <span className="font-mono text-[10px] text-neutral-800 truncate">
              api.morphic.id/v1
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 font-bold shrink-0">
              API Key
            </span>
            <span className="font-mono text-[10px] text-neutral-800">mp-live-••••••</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-neutral-500 group-hover:text-emerald-700 transition-colors">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] font-mono font-bold">HTTP 200 OK</span>
          </div>
        </div>
      ),
    },
    {
      num: t.steps.step4Num,
      title: t.steps.step4Title,
      desc: t.steps.step4Desc,
      badge: t.steps.step4Badge,
      icon: Bot,
      preview: (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Bot className="h-4 w-4 text-neutral-900 shrink-0" />
              <span className="font-mono text-[10px] font-bold text-neutral-800 truncate">
                deepseek-v4-coder
              </span>
            </div>
            <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-neutral-500 group-hover:text-emerald-700 shrink-0 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 group-hover:bg-emerald-500 transition-colors" />
              READY
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-neutral-200 w-11/12" />
            <div className="h-2 rounded-full bg-neutral-200 w-3/5" />
            <div className="h-2 rounded-full bg-neutral-200 group-hover:bg-neutral-900/80 w-4/5 transition-colors duration-500" />
          </div>
          <div className="mt-2.5 text-[9px] font-mono font-bold text-neutral-400">
            180 RPM · streaming
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="integration"
      className="steps-section steps-font relative z-10 py-24 px-4 sm:px-6 text-neutral-900 overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header — minimal eyebrow, no pill badge */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="steps-reveal text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-bold mb-4">
            {locale === 'en' ? 'How it works' : 'Cara Kerja'}
          </div>

          <h2 className="steps-reveal text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-neutral-950">
            {t.steps.title}
          </h2>

          <p className="steps-reveal text-neutral-600 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {t.steps.desc}
          </p>
        </div>

        {/* Connected Setup Flow: vertical timeline on mobile/tablet, 4-column rail on desktop */}
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-9 list-none">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === steps.length - 1;
            return (
              <li
                key={step.num}
                className={`steps-item steps-reveal ${isLast ? 'steps-item-last' : ''}`}
                style={{ '--reveal-delay': `${i * 90}ms` } as CSSProperties}
              >
                <div className="steps-rail">
                  <span className="steps-node">{step.num}</span>
                  <span className="steps-rail-line" aria-hidden="true" />
                </div>

                <div className="group rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-neutral-300 hover:shadow-[0_12px_28px_-14px_rgba(9,9,11,0.18)] hover:-translate-y-1 flex flex-col h-full">
                  {/* Mini UI preview (decorative, monochrome until hover) */}
                  <div
                    className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 mb-5 min-h-[124px] flex flex-col justify-center"
                    aria-hidden="true"
                  >
                    {step.preview}
                  </div>

                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="h-4 w-4 text-neutral-400 group-hover:text-neutral-900 shrink-0 transition-colors" />
                    <h3 className="font-extrabold text-base text-neutral-950 tracking-tight leading-snug">
                      {step.title}
                    </h3>
                  </div>

                  <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-neutral-400 mb-2.5">
                    {step.badge}
                  </div>

                  <p className="text-xs sm:text-[13px] text-neutral-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Footer note + CTA */}
        <div className="steps-reveal mt-16 flex flex-col items-center text-center gap-4">
          <p className="text-xs text-neutral-500 max-w-md leading-relaxed">{t.steps.footerNote}</p>
          <Link
            href={isLoggedIn ? '/dashboard/keys' : '/login'}
            className="btn-hero-primary inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <span>{isLoggedIn ? t.steps.ctaLoggedIn : t.steps.ctaGuest}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 btn-hero-icon" />
          </Link>
        </div>
      </div>
    </section>
  );
}
