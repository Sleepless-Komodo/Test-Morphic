'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function MemberPricingBanner({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-3xl border border-neutral-200/90 bg-white p-8 md:p-10 shadow-sm text-center max-w-4xl mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-950 mx-auto mb-4 shadow-sm">
        <Zap className="h-6 w-6" />
      </div>

      <h3 className="text-2xl font-heading font-bold text-neutral-950 mb-2">
        {t.models.memberPricingTitle}
      </h3>

      <p className="text-neutral-600 text-xs sm:text-sm max-w-xl mx-auto mb-6 leading-relaxed">
        {t.models.memberPricingDesc}
      </p>

      <Link
        href={isLoggedIn ? '/dashboard' : '/login'}
        className="inline-flex items-center justify-center gap-2 bg-neutral-950 text-white rounded-full px-8 py-3 text-xs sm:text-sm font-bold hover:bg-neutral-800 transition-all shadow-md hover:shadow-lg"
      >
        <span>{isLoggedIn ? t.models.memberPricingBtnMember : t.models.memberPricingBtnGuest}</span>
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
