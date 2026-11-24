'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { buildPricingMatrix, type BillingPackage, type PackageKind } from '@/lib/billing-format';
import { GATEWAY_LIMITS } from '@/lib/gateway-limits';
import { loginUrl } from '@/lib/safe-next';

const EASE = [0.16, 1, 0.3, 1] as const;

interface PricingComparisonTableProps {
  /** Active packages from the database; the columns are the kinds of package on sale. */
  packages: BillingPackage[];
  isLoggedIn?: boolean;
}

export default function PricingComparisonTable({ packages, isLoggedIn = false }: PricingComparisonTableProps) {
  const { locale } = useTranslation();
  const en = locale === 'en';
  const { columns, groups } = buildPricingMatrix(packages, en, GATEWAY_LIMITS);

  const [pickedKind, setPickedKind] = useState<PackageKind | null>(null);
  if (columns.length === 0) return null;

  const activeIndex = Math.max(0, columns.findIndex((column) => column.kind === pickedKind));
  const activeColumn = columns[activeIndex]!;

  // Each button opens that kind's cheapest package in Billing; a guest signs in first and lands there.
  const checkoutUrl = (packageId: string) => {
    const billing = `/dashboard/billing?pkg=${packageId}`;
    return isLoggedIn ? billing : loginUrl(billing);
  };

  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-neutral-950 text-white">
          <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
          <span className="sr-only">{en ? 'Included' : 'Termasuk'}</span>
        </span>
      ) : (
        <span className="font-mono text-sm text-neutral-300" aria-hidden="true">
          —
        </span>
      );
    }
    return <span className="font-mono text-xs font-semibold text-neutral-900">{value}</span>;
  };

  const chooseLabel = en ? 'Choose' : 'Pilih';

  return (
    <section className="relative z-10 py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[#fafafa] border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.55, ease: EASE }}
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
        >
          <p suppressHydrationWarning className="mb-3 text-sm font-medium text-neutral-500">
            {en ? 'Package comparison' : 'Perbandingan paket'}
          </p>
          <h2 suppressHydrationWarning className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold tracking-tight text-neutral-950 text-balance">
            {en ? 'Compare the packages' : 'Bandingkan paket'}
          </h2>
          <p suppressHydrationWarning className="mt-4 text-neutral-600 font-body text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-balance">
            {en
              ? 'What each kind of package gives you, and the limits that stay the same for every account.'
              : 'Apa yang didapat dari tiap jenis paket, dan batas yang sama untuk semua akun.'}
          </p>
        </motion.div>

        {/* Phones: one package kind at a time. */}
        <div className="block md:hidden">
          {columns.length > 1 && (
            <div role="tablist" aria-label={en ? 'Package kind' : 'Jenis paket'} className="flex items-center justify-center p-1 rounded-full bg-white border border-neutral-200/90 shadow-2xs mb-6 max-w-sm mx-auto">
              {columns.map((column) => {
                const isSelected = column.kind === activeColumn.kind;
                return (
                  <button
                    key={column.kind}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setPickedKind(column.kind)}
                    className={`relative flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-colors duration-200 text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${
                      isSelected ? 'text-white' : 'text-neutral-600 hover:text-neutral-950'
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="mobile-pricing-tab"
                        className="absolute inset-0 rounded-full bg-neutral-950"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <span suppressHydrationWarning className="relative">{column.title}</span>
                  </button>
                );
              })}
            </div>
          )}

          <motion.div
            key={activeColumn.kind}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-6"
          >
            <div className="flex items-center justify-between pb-5 border-b border-neutral-100">
              <div>
                <span suppressHydrationWarning className="font-heading text-xl font-bold text-neutral-950">{activeColumn.title}</span>
                <div suppressHydrationWarning className="mt-1 font-mono text-2xl font-extrabold text-neutral-950">{activeColumn.price}</div>
              </div>
              <Link
                href={checkoutUrl(activeColumn.packageId)}
                className="shrink-0 inline-flex items-center gap-1.5 py-2.5 px-4 rounded-full bg-neutral-950 text-white text-xs font-bold shadow-xs hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
              >
                <span suppressHydrationWarning>{chooseLabel}</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="space-y-6 text-sm">
              {groups.map((group) => (
                <div key={group.title} className="space-y-2.5">
                  <div suppressHydrationWarning className="font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    {group.title}
                  </div>
                  <div className="divide-y divide-neutral-100 rounded-2xl bg-neutral-50/70 border border-neutral-200/70 px-4 py-1">
                    {group.rows.map((row) => (
                      <div key={row.name} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <span suppressHydrationWarning className="text-neutral-700 font-medium">{row.name}</span>
                        <span suppressHydrationWarning className="shrink-0 text-right">{renderValue(row.cells[activeIndex]!)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* From md up: every kind side by side. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="hidden md:block rounded-[26px] border border-neutral-200/90 bg-white shadow-xs overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-50/90 border-b border-neutral-200/90">
                <tr>
                  <th suppressHydrationWarning scope="col" className="py-5 px-6 font-mono text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    {en ? 'Package' : 'Paket'}
                  </th>
                  {columns.map((column) => (
                    <th key={column.kind} scope="col" className="py-5 px-5 text-center">
                      <div suppressHydrationWarning className="font-heading font-bold text-sm text-neutral-900">{column.title}</div>
                      <div suppressHydrationWarning className="font-mono text-xs text-neutral-500 font-normal mt-0.5">{column.price}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <React.Fragment key={group.title}>
                    <tr className="bg-neutral-50/60 border-y border-neutral-100">
                      <th
                        suppressHydrationWarning
                        scope="colgroup"
                        colSpan={columns.length + 1}
                        className="py-3 px-6 text-left font-mono text-[11px] uppercase tracking-[0.14em] font-bold text-neutral-500"
                      >
                        {group.title}
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.name} className="border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors">
                        <th suppressHydrationWarning scope="row" className="py-3.5 px-6 text-left text-xs sm:text-sm text-neutral-800 font-medium">
                          {row.name}
                        </th>
                        {row.cells.map((cell, index) => (
                          <td key={columns[index]!.kind} suppressHydrationWarning className="py-3.5 px-5 text-center">
                            {renderValue(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-neutral-50/80 border-t border-neutral-200/90">
                  <th suppressHydrationWarning scope="row" className="py-5 px-6 text-left font-mono text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    {en ? 'Choose a package' : 'Pilih paket'}
                  </th>
                  {columns.map((column) => (
                    <td key={column.kind} className="py-5 px-5 text-center">
                      <Link
                        href={checkoutUrl(column.packageId)}
                        className="inline-flex items-center justify-center gap-1 w-full max-w-[140px] py-2 px-3 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
                      >
                        <span suppressHydrationWarning>{chooseLabel}</span>
                        <span className="sr-only" suppressHydrationWarning>{column.title}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
