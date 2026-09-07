'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, QrCode, KeyRound, TerminalSquare, Bot, Sparkles, Zap, Shield, Activity, Cpu } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface HowItWorksStepsProps {
  isLoggedIn?: boolean;
}

export default function HowItWorksSteps({ isLoggedIn = false }: HowItWorksStepsProps) {
  const { t } = useTranslation();

  const steps = [
    {
      num: t.steps.step1Num,
      title: t.steps.step1Title,
      desc: t.steps.step1Desc,
      icon: QrCode,
      badge: t.steps.step1Badge,
    },
    {
      num: t.steps.step2Num,
      title: t.steps.step2Title,
      desc: t.steps.step2Desc,
      icon: KeyRound,
      badge: t.steps.step2Badge,
    },
    {
      num: t.steps.step3Num,
      title: t.steps.step3Title,
      desc: t.steps.step3Desc,
      icon: TerminalSquare,
      badge: t.steps.step3Badge,
    },
    {
      num: t.steps.step4Num,
      title: t.steps.step4Title,
      desc: t.steps.step4Desc,
      icon: Bot,
      badge: t.steps.step4Badge,
    },
  ];

  return (
    <section id="integration" className="relative z-10 py-24 px-4 sm:px-6 bg-white text-neutral-900 border-t border-neutral-200/90 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-semibold mb-4 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-neutral-950" />
            <span>{t.steps.badge}</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-heading font-extrabold tracking-tight mb-4 text-neutral-950">
            {t.steps.title}
          </h2>

          <p className="text-neutral-600 font-body text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {t.steps.desc}
          </p>
        </div>

        {/* 2-Column Grid: Left Visual Card + Right Steps Sequence */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Modern Gateway Telemetry Card (Replaces Old Cartoon Robot) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center text-center">
            <div className="relative w-full max-w-sm aspect-square flex items-center justify-center select-none">
              {/* Subtle ambient glow behind card */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-neutral-200/50 via-neutral-100/30 to-transparent blur-3xl pointer-events-none" />

              {/* Main Card Container (Matches screenshot layout with crisp white surface) */}
              <div className="relative z-10 w-full rounded-3xl bg-white border border-neutral-200/90 p-8 flex flex-col items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.06)] hover:border-neutral-300 hover:shadow-xl transition-all duration-300">
                {/* Modern High-Tech Gateway Core Visual (Replacing the cartoon robot) */}
                <div className="relative w-28 h-28 mb-5 flex items-center justify-center">
                  <div className="absolute inset-0 bg-neutral-100 rounded-full blur-md" />
                  {/* Subtle rotating orbit ring */}
                  <div className="absolute w-28 h-28 rounded-full border border-dashed border-neutral-300 animate-[spin_30s_linear_infinite] pointer-events-none" />
                  
                  {/* Serverless Proxy Chip Icon */}
                  <div className="relative z-10 w-20 h-20 rounded-2xl bg-neutral-950 text-white flex items-center justify-center shadow-lg border border-neutral-800">
                    <Cpu className="w-10 h-10 text-neutral-100" />
                    {/* Glowing core indicator */}
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                </div>

                {/* Status and Title */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800 mb-2 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>AI GATEWAY ONLINE</span>
                  </div>
                  <div className="text-sm font-heading font-bold text-neutral-950 tracking-tight">
                    Autonomous Coding Engine
                  </div>
                  <div className="text-xs text-neutral-500 font-mono mt-1">
                    Ready: Claude · DeepSeek · Qwen
                  </div>
                </div>

                {/* Floating Telemetry Chips Around Card (As in the original screenshot) */}
                <div className="absolute -top-3.5 -left-3 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 text-[11px] font-mono font-medium text-neutral-800 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>180 RPM Limit</span>
                </div>

                <div className="absolute -top-3.5 -right-3 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 text-[11px] font-mono font-medium text-neutral-800 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-blue-600" />
                  <span>99.9% Uptime</span>
                </div>

                <div className="absolute -bottom-3.5 right-4 px-3 py-1.5 rounded-xl bg-white border border-neutral-200/90 text-[11px] font-mono font-medium text-neutral-800 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Key: mp-live-active</span>
                </div>
              </div>
            </div>

            {/* Subtext and Action Link */}
            <div className="mt-8">
              <p className="text-xs text-neutral-500 font-body max-w-xs mx-auto mb-3 leading-relaxed">
                {t.steps.footerNote}
              </p>
              <Link
                href={isLoggedIn ? '/dashboard/keys' : '/login'}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-950 hover:text-black transition-colors underline underline-offset-4"
              >
                <span>{isLoggedIn ? t.steps.ctaLoggedIn : t.steps.ctaGuest}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Right Column: 4 Steps Sequence Cards */}
          <div className="lg:col-span-7 space-y-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="rounded-2xl border border-neutral-200/90 bg-neutral-50/70 p-5 sm:p-6 flex items-start gap-4 sm:gap-5 hover:border-neutral-300 hover:bg-white hover:shadow-md transition-all group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white border border-neutral-200/90 flex items-center justify-center text-neutral-900 shrink-0 group-hover:bg-neutral-100 shadow-2xs transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono text-neutral-400 font-bold">
                          {step.num}
                        </span>
                        <h3 className="font-heading font-bold text-base md:text-lg text-neutral-950">
                          {step.title}
                        </h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white text-neutral-700 border border-neutral-200/90 shadow-2xs font-mono">
                        {step.badge}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-600 font-body leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
