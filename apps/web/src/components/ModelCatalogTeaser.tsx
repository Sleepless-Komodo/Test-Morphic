'use client';

import React from 'react';
import Link from 'next/link';
import { ALL_MODELS } from '@/lib/models-data';
import ModelCard from './ModelCard';
import { useTranslation } from '@/lib/i18n';
import { ArrowUpRight } from 'lucide-react';

export default function ModelCatalogTeaser({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const { t } = useTranslation();
  // Show top 4 flagship/popular models on landing page
  const teaserModels = ALL_MODELS.slice(0, 4);

  return (
    <section id="models" className="relative z-10 py-20 px-4 sm:px-6 bg-[#fafafa] text-neutral-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-bold mb-3">
              {t.models.badge}
            </div>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight text-neutral-950">
              {t.models.title}
            </h2>
            <p className="text-neutral-600 font-body text-sm sm:text-base mt-2 max-w-xl">
              {t.models.desc}
            </p>
          </div>

          <Link
            href="/models"
            className="group inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-950 hover:text-black bg-white border border-neutral-300 hover:border-neutral-950 rounded-full px-5 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 self-start md:self-auto"
          >
            <span>{t.models.viewAllModels}</span>
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        {/* 4 Flagship Models Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {teaserModels.map((model) => (
            <ModelCard key={model.id} model={model} isLoggedIn={isLoggedIn} />
          ))}
        </div>
      </div>
    </section>
  );
}
