'use client';

import { XCircle, CheckCircle2, CreditCard, Zap, Layers, Lock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function MarketingProblemSolution() {
  const { t } = useTranslation();

  const comparisons = [
    {
      problem: t.problemSolution.card1Problem,
      problemDesc: t.problemSolution.card1ProblemDesc,
      solution: t.problemSolution.card1Solution,
      solutionDesc: t.problemSolution.card1SolutionDesc,
      icon: CreditCard,
    },
    {
      problem: t.problemSolution.card2Problem,
      problemDesc: t.problemSolution.card2ProblemDesc,
      solution: t.problemSolution.card2Solution,
      solutionDesc: t.problemSolution.card2SolutionDesc,
      icon: Zap,
    },
    {
      problem: t.problemSolution.card3Problem,
      problemDesc: t.problemSolution.card3ProblemDesc,
      solution: t.problemSolution.card3Solution,
      solutionDesc: t.problemSolution.card3SolutionDesc,
      icon: Layers,
    },
    {
      problem: t.problemSolution.card4Problem,
      problemDesc: t.problemSolution.card4ProblemDesc,
      solution: t.problemSolution.card4Solution,
      solutionDesc: t.problemSolution.card4SolutionDesc,
      icon: Lock,
    },
  ];

  return (
    <section id="keunggulan" className="relative z-10 py-24 px-4 sm:px-6 bg-[#fafafa] text-neutral-900 border-t border-neutral-200/80 content-deferred">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-xs font-semibold mb-4 shadow-sm">
            <span suppressHydrationWarning>{t.problemSolution.badge}</span>
          </div>

          <h2 suppressHydrationWarning className="text-3xl md:text-5xl font-heading font-extrabold tracking-tight leading-tight mb-5 text-neutral-950">
            {t.problemSolution.title}
          </h2>

          <p suppressHydrationWarning className="text-neutral-600 font-body text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {t.problemSolution.desc}
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {comparisons.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl border border-neutral-200/90 bg-white p-6 md:p-8 flex flex-col justify-between hover:border-neutral-300 hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-100">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900 group-hover:bg-neutral-200/70 transition-colors shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 suppressHydrationWarning className="font-heading font-bold text-lg text-neutral-950">{item.solution}</h3>
                </div>

                {/* The Old Pain (Problem) */}
                <div className="mb-4 p-4 rounded-2xl bg-rose-50/80 border border-rose-200/80 text-xs text-rose-950 flex items-start gap-3">
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span suppressHydrationWarning className="font-semibold text-rose-800 block mb-1">
                      {t.problemSolution.problemLabel} {item.problem}
                    </span>
                    <span suppressHydrationWarning className="text-rose-700/90 leading-relaxed block">{item.problemDesc}</span>
                  </div>
                </div>

                {/* The Morphic Advantage (Solution) */}
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span suppressHydrationWarning className="font-semibold text-emerald-800 block mb-1">{t.problemSolution.solutionLabel}</span>
                    <span suppressHydrationWarning className="text-emerald-700/90 leading-relaxed block">{item.solutionDesc}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
