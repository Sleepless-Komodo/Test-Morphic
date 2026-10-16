'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { Check, ArrowUpRight, Sparkles, SlidersHorizontal, Table } from 'lucide-react';
import Link from 'next/link';

const EASE = [0.16, 1, 0.3, 1] as const;

interface FeatureRow {
  name: string;
  tooltip?: string;
  starter: string | boolean;
  pro: string | boolean;
  ultra: string | boolean;
}

interface FeatureCategory {
  category: string;
  rows: FeatureRow[];
}

type MobileTier = 'starter' | 'pro' | 'ultra';

export default function PricingComparisonTable({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const { locale, t } = useTranslation();
  const en = locale === 'en';

  const [mobileTier, setMobileTier] = useState<MobileTier>('pro');
  const [mobileShowFullTable, setMobileShowFullTable] = useState(false);

  const targetBillingUrl = isLoggedIn ? '/dashboard/billing' : '/login';

  const matrix: FeatureCategory[] = [
    {
      category: en ? 'Throughput & Capacity Limits' : 'Batas Throughput & Kapasitas',
      rows: [
        {
          name: en ? 'Rate Limit (Requests / Min)' : 'Batas Panggilan (RPM)',
          starter: '60 RPM',
          pro: '120 RPM',
          ultra: '180 RPM',
        },
        {
          name: en ? 'Token Throughput (TPM)' : 'Batas Token per Menit (TPM)',
          starter: '100K TPM',
          pro: '250K TPM',
          ultra: '500K TPM',
        },
        {
          name: en ? 'Max Concurrent Streams' : 'Koneksi Stream Simultan',
          starter: '3 Streams',
          pro: '8 Streams',
          ultra: '20 Streams',
        },
        {
          name: en ? 'Median Upstream Latency' : 'Median Latensi Routing',
          starter: '< 150ms',
          pro: '< 145ms',
          ultra: '< 140ms (Priority Queue)',
        },
      ],
    },
    {
      category: en ? 'AI Model Catalog Access' : 'Akses Katalog Model AI',
      rows: [
        {
          name: 'Claude 3.5 Sonnet & Haiku',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: 'DeepSeek V4 Coder',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: 'Qwen 2.5 Max (128K Context)',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: 'Kimi K1.5 Preview',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: en ? 'Experimental & Preview Routes' : 'Rute Eksperimental & Preview',
          starter: false,
          pro: true,
          ultra: true,
        },
      ],
    },
    {
      category: en ? 'Developer Experience & Tooling' : 'Fitur Integrasi & Developer Tools',
      rows: [
        {
          name: en ? 'Active API Keys' : 'Jumlah Kunci API Aktif',
          starter: '2 Keys',
          pro: '10 Keys',
          ultra: 'Unlimited Keys',
        },
        {
          name: en ? 'Custom Key Labeling (Cursor, Prod)' : 'Label Kunci Khusus (Cursor, Prod)',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: en ? 'OpenAI Format Drop-in (/v1)' : 'Format Standar OpenAI SDK (/v1)',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: en ? 'SSE Streaming & Tool Calls' : 'Dukungan Streaming & Tool Calls',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: en ? 'Automatic Cluster Failover' : 'Failover Otomatis (Zero Drop)',
          starter: true,
          pro: true,
          ultra: true,
        },
      ],
    },
    {
      category: en ? 'Security & Privacy Compliance' : 'Keamanan & Privasi Data',
      rows: [
        {
          name: en ? 'Zero Data Retention (No Training)' : 'Zero Data Retention (Data Tidak Di-training)',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: en ? 'API Key Encryption Standard' : 'Standar Enkripsi Kunci Rahasia',
          starter: 'AES-256',
          pro: 'AES-256',
          ultra: 'AES-256',
        },
        {
          name: en ? 'Request Activity Log History' : 'Riwayat Log Aktivitas Request',
          starter: en ? '7 Days' : '7 Hari',
          pro: en ? '30 Days' : '30 Hari',
          ultra: en ? '90 Days' : '90 Hari',
        },
      ],
    },
    {
      category: en ? 'Billing & Support Service' : 'Ketentuan Billing & Layanan Dukungan',
      rows: [
        {
          name: en ? 'Instant QRIS Settlement (GoPay, BCA)' : 'Pembayaran QRIS Instan (BCA, GoPay, dll)',
          starter: true,
          pro: true,
          ultra: true,
        },
        {
          name: en ? 'Credit Balance Expiration' : 'Masa Berlaku Saldo Kuota',
          starter: en ? 'Never expires' : 'Selamanya',
          pro: en ? 'Never expires' : 'Selamanya',
          ultra: en ? 'Never expires' : 'Selamanya',
        },
        {
          name: en ? 'Monthly Commitment / Subscription' : 'Komitmen Biaya Langganan Bulanan',
          starter: 'Rp 0 (Pay-as-you-go)',
          pro: 'Rp 0 (Pay-as-you-go)',
          ultra: 'Rp 0 (Pay-as-you-go)',
        },
        {
          name: en ? 'Support Channel SLA' : 'Saluran Bantuan & Dukungan',
          starter: en ? 'Discord Community' : 'Komunitas Discord',
          pro: en ? 'Priority Email' : 'Email Prioritas',
          ultra: en ? 'Dedicated Chat & SLA' : 'Dedicated Chat & SLA',
        },
      ],
    },
  ];

  const renderValue = (val: string | boolean) => {
    if (typeof val === 'boolean') {
      return val ? (
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
    return <span className="font-mono text-xs font-semibold text-neutral-900">{val}</span>;
  };

  const getTierMeta = (tier: MobileTier) => {
    switch (tier) {
      case 'starter':
        return {
          name: 'Starter',
          price: 'Rp 15.000',
          desc: en ? 'For individuals exploring AI APIs' : 'Untuk eksplorasi personal & uji coba IDE',
        };
      case 'pro':
        return {
          name: 'Pro',
          price: 'Rp 49.000',
          badge: en ? 'Popular' : 'Terpopuler',
          desc: en ? 'Best for everyday coding in Cursor & Cline' : 'Paling pas untuk kebutuhan coding harian',
        };
      case 'ultra':
        return {
          name: 'Ultra / Team',
          price: 'Rp 149.000',
          desc: en ? 'High concurrency for heavy workflows & teams' : 'Throughput tinggi untuk beban kerja intensif',
        };
    }
  };

  const currentTierMeta = getTierMeta(mobileTier);

  return (
    <section className="relative z-10 py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[#fafafa] border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.55, ease: EASE }}
          className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
        >
          <p suppressHydrationWarning className="mb-3 text-sm font-medium text-neutral-500">
            {en ? 'Feature Matrix' : 'Tabel Komparasi Fitur'}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold tracking-tight text-neutral-950 text-balance">
            {en ? 'Compare Plan Limits & Specifications' : 'Perbandingan Spesifikasi & Fitur Lengkap'}
          </h2>
          <p className="mt-4 text-neutral-600 font-body text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-balance">
            {en
              ? 'Transparent technical specifications for every tier. No hidden throttling, zero lock-in.'
              : 'Spesifikasi teknis transparan untuk setiap paket kuota. Bebas biaya tersembunyi, tanpa langganan mengikat.'}
          </p>
        </motion.div>

        {/* 1. Mobile-Optimized Tier Inspector (< 768px) */}
        <div className="block md:hidden">
          {/* Segmented Control Pill */}
          <div className="flex items-center justify-center p-1 rounded-full bg-white border border-neutral-200/90 shadow-2xs mb-6 max-w-xs mx-auto">
            {(['starter', 'pro', 'ultra'] as const).map((t) => {
              const meta = getTierMeta(t);
              const isSelected = mobileTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMobileTier(t)}
                  className={`relative flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-colors duration-200 text-center cursor-pointer ${
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
                  <span className="relative flex items-center justify-center gap-1">
                    {meta.name}
                    {t === 'pro' && <span className="text-[10px]">★</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Tier Mobile Card */}
          <motion.div
            key={mobileTier}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="rounded-[26px] border border-neutral-200/90 bg-white p-6 shadow-xs space-y-6"
          >
            {/* Header info */}
            <div className="flex items-center justify-between pb-5 border-b border-neutral-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-xl font-bold text-neutral-950">
                    {currentTierMeta.name}
                  </span>
                  {currentTierMeta.badge && (
                    <span className="rounded-full bg-neutral-950 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-white">
                      {currentTierMeta.badge}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-2xl font-extrabold text-neutral-950">
                  {currentTierMeta.price}
                </div>
                <p className="mt-1 text-xs text-neutral-500 font-body">
                  {currentTierMeta.desc}
                </p>
              </div>

              <Link
                href={targetBillingUrl}
                className="shrink-0 inline-flex items-center gap-1.5 py-2.5 px-4 rounded-full bg-neutral-950 text-white text-xs font-bold shadow-xs hover:bg-neutral-800 transition-colors"
              >
                <span>{en ? 'Choose' : 'Pilih'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Categorized specs list */}
            <div className="space-y-6 text-sm">
              {matrix.map((cat, catIdx) => (
                <div key={catIdx} className="space-y-2.5">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    {cat.category}
                  </div>
                  <div className="divide-y divide-neutral-100 rounded-2xl bg-neutral-50/70 border border-neutral-200/70 px-4 py-1">
                    {cat.rows.map((row, rowIdx) => {
                      const val = row[mobileTier];
                      return (
                        <div key={rowIdx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <span className="text-neutral-700 font-medium">{row.name}</span>
                          <span className="shrink-0 text-right">{renderValue(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* View Full Horizontal Table Toggle for Mobile */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMobileShowFullTable(!mobileShowFullTable)}
                className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-neutral-500 hover:text-neutral-950 transition-colors"
              >
                <Table className="w-3.5 h-3.5" />
                <span>
                  {mobileShowFullTable
                    ? en
                      ? 'Hide Full Table View'
                      : 'Tutup Tampilan Tabel'
                    : en
                      ? 'Swipe Full Comparison Table'
                      : 'Lihat Seluruh Kolom Tabel'}
                </span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* 2. Full Matrix Desktop Table (and mobile when toggled) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className={`${
            mobileShowFullTable ? 'block' : 'hidden md:block'
          } mt-6 md:mt-0 rounded-[26px] border border-neutral-200/90 bg-white shadow-xs overflow-hidden`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[660px]">
              {/* Sticky Header */}
              <thead className="bg-neutral-50/90 border-b border-neutral-200/90">
                <tr>
                  <th className="py-5 px-6 font-mono text-xs uppercase tracking-wider text-neutral-500 font-bold w-[40%]">
                    {en ? 'Specification & Limits' : 'Spesifikasi & Limitasi'}
                  </th>
                  <th className="py-5 px-5 text-center w-[20%]">
                    <div className="font-heading font-bold text-sm text-neutral-900">Starter</div>
                    <div className="font-mono text-xs text-neutral-500 font-normal mt-0.5">Rp 15.000</div>
                  </th>
                  <th className="py-5 px-5 text-center w-[20%] bg-neutral-100/60 border-x border-neutral-200/80">
                    <div className="inline-flex items-center gap-1">
                      <span className="font-heading font-extrabold text-sm text-neutral-950">Pro</span>
                      <span className="rounded-full bg-neutral-950 px-2 py-0.2 text-[10px] font-mono text-white font-semibold">
                        {en ? 'Popular' : 'Populer'}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-neutral-600 font-semibold mt-0.5">Rp 49.000</div>
                  </th>
                  <th className="py-5 px-5 text-center w-[20%]">
                    <div className="font-heading font-bold text-sm text-neutral-900">Ultra / Team</div>
                    <div className="font-mono text-xs text-neutral-500 font-normal mt-0.5">Rp 149.000</div>
                  </th>
                </tr>
              </thead>

              {/* Matrix Categories & Rows */}
              <tbody>
                {matrix.map((group, groupIdx) => (
                  <React.Fragment key={groupIdx}>
                    {/* Category Divider Header */}
                    <tr className="bg-neutral-50/60 border-y border-neutral-100">
                      <td
                        colSpan={4}
                        className="py-3 px-6 font-mono text-[11px] uppercase tracking-[0.14em] font-bold text-neutral-400"
                      >
                        {group.category}
                      </td>
                    </tr>

                    {/* Category Rows */}
                    {group.rows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors"
                      >
                        <td className="py-3.5 px-6 text-xs sm:text-sm text-neutral-800 font-medium">
                          {row.name}
                        </td>
                        <td className="py-3.5 px-5 text-center">{renderValue(row.starter)}</td>
                        <td className="py-3.5 px-5 text-center bg-neutral-50/40 border-x border-neutral-200/50">
                          {renderValue(row.pro)}
                        </td>
                        <td className="py-3.5 px-5 text-center">{renderValue(row.ultra)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>

              {/* Bottom Footer CTA Row */}
              <tfoot>
                <tr className="bg-neutral-50/80 border-t border-neutral-200/90">
                  <td className="py-5 px-6 font-mono text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    {en ? 'Instant QRIS Top-up' : 'Pilihan Paket'}
                  </td>
                  <td className="py-5 px-5 text-center">
                    <Link
                      href={targetBillingUrl}
                      className="inline-flex items-center justify-center gap-1 w-full max-w-[120px] py-2 px-3 rounded-full border border-neutral-300 hover:border-neutral-950 bg-white text-neutral-900 text-xs font-bold transition-all hover:bg-neutral-950 hover:text-white cursor-pointer"
                    >
                      <span>Starter</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                  <td className="py-5 px-5 text-center bg-neutral-100/60 border-x border-neutral-200/80">
                    <Link
                      href={targetBillingUrl}
                      className="inline-flex items-center justify-center gap-1 w-full max-w-[120px] py-2 px-3 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <span>{t.pricing.choosePro}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                  <td className="py-5 px-5 text-center">
                    <Link
                      href={targetBillingUrl}
                      className="inline-flex items-center justify-center gap-1 w-full max-w-[120px] py-2 px-3 rounded-full border border-neutral-300 hover:border-neutral-950 bg-white text-neutral-900 text-xs font-bold transition-all hover:bg-neutral-950 hover:text-white cursor-pointer"
                    >
                      <span>Ultra</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
