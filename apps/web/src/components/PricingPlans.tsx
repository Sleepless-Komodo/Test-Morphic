'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ArrowUpRight, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const EASE = [0.16, 1, 0.3, 1] as const;
const STACK_SPRING = { type: 'spring' as const, stiffness: 260, damping: 28, mass: 0.8 };
const TILT_SPRING = { stiffness: 150, damping: 18, mass: 0.5 };

interface PricingPlansProps {
  isLoggedIn?: boolean;
  showPricingHubLink?: boolean;
}

type Mode = 'credits' | 'daily';
type Plan = {
  name: string;
  price: string;
  amount: string; // the big figure on the card
  unit: string;
  desc: string;
  note?: string;
  noteLabel?: string;
  features: string[];
  badge?: string;
  cta: string;
};

/** Counts the numeric part of a formatted price ("Rp 49,000") to its new value. */
function RollingPrice({ price, locale }: { price: string; locale: string }) {
  const target = Number(price.replace(/\D/g, ''));
  const prefix = price.match(/^\D*/)?.[0] ?? '';
  const value = useMotionValue(target);
  const text = useTransform(value, (v) => prefix + Math.round(v).toLocaleString(locale === 'en' ? 'en-US' : 'id-ID'));

  useEffect(() => {
    const c = animate(value, target, { duration: 0.7, ease: EASE });
    return () => c.stop();
  }, [target, value]);

  return <motion.span className="tabular-nums">{text}</motion.span>;
}

interface TierMaterial {
  background: string;
  borderColor: string;
  radialHighlight: string;
  sheenOverlay: string;
  kindClass: string;
  brandTextClass: string;
  logoRing: string;
  titleClass: string;
  amountClass: string;
  unitClass: string;
  priceClass: string;
}

function getTierMaterial(mode: Mode, index: number, name: string): TierMaterial {
  const n = name.toLowerCase();

  if (mode === 'credits') {
    // 1. Starter Dev: Cool Titanium Silver
    if (n.includes('starter') || index === 0) {
      return {
        background: 'linear-gradient(145deg, #161c24 0%, #0d1117 100%)',
        borderColor: 'rgba(203, 213, 225, 0.22)',
        radialHighlight: 'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(226, 232, 240, 0.18), transparent 70%)',
        sheenOverlay:
          'linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0.02) 40%, rgba(255, 255, 255, 0.07) 50%, rgba(255, 255, 255, 0.01) 60%, transparent 100%)',
        kindClass: 'text-slate-300 border-slate-400/25 bg-slate-400/10',
        brandTextClass: 'text-slate-100',
        logoRing: 'ring-1 ring-slate-400/25',
        titleClass: 'text-slate-100',
        amountClass: 'text-white',
        unitClass: 'text-slate-400',
        priceClass: 'text-slate-300',
      };
    }
    // 2. Pro Agent: Champagne Obsidian Gold
    if (n.includes('pro') || index === 1) {
      return {
        background: 'linear-gradient(145deg, #1b1610 0%, #0d0a07 100%)',
        borderColor: 'rgba(245, 158, 11, 0.28)',
        radialHighlight: 'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(251, 191, 36, 0.18), transparent 70%)',
        sheenOverlay:
          'linear-gradient(115deg, transparent 0%, rgba(245, 158, 11, 0.03) 40%, rgba(251, 191, 36, 0.08) 50%, rgba(245, 158, 11, 0.02) 60%, transparent 100%)',
        kindClass: 'text-amber-300 border-amber-500/25 bg-amber-500/10',
        brandTextClass: 'text-amber-100',
        logoRing: 'ring-1 ring-amber-500/30',
        titleClass: 'text-amber-100',
        amountClass: 'text-amber-50',
        unitClass: 'text-amber-200/70',
        priceClass: 'text-amber-200/90',
      };
    }
    // 3. Heavy Coder: Void Onyx Black
    return {
      background: 'linear-gradient(145deg, #0e0e11 0%, #050506 100%)',
      borderColor: 'rgba(255, 255, 255, 0.16)',
      radialHighlight: 'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(255, 255, 255, 0.12), transparent 70%)',
      sheenOverlay:
        'linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0.02) 40%, rgba(255, 255, 255, 0.06) 50%, rgba(255, 255, 255, 0.01) 60%, transparent 100%)',
      kindClass: 'text-neutral-300 border-white/10 bg-white/5',
      brandTextClass: 'text-neutral-100',
      logoRing: 'ring-1 ring-white/15',
      titleClass: 'text-neutral-100',
      amountClass: 'text-white',
      unitClass: 'text-neutral-400',
      priceClass: 'text-neutral-300',
    };
  }

  // Daily pass tiers
  if (n.includes('all-access') || index === 3) {
    return {
      background: 'linear-gradient(145deg, #1b1610 0%, #0d0a07 100%)',
      borderColor: 'rgba(245, 158, 11, 0.28)',
      radialHighlight: 'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(251, 191, 36, 0.18), transparent 70%)',
      sheenOverlay:
        'linear-gradient(115deg, transparent 0%, rgba(245, 158, 11, 0.03) 40%, rgba(251, 191, 36, 0.08) 50%, rgba(245, 158, 11, 0.02) 60%, transparent 100%)',
      kindClass: 'text-amber-300 border-amber-500/25 bg-amber-500/10',
      brandTextClass: 'text-amber-100',
      logoRing: 'ring-1 ring-amber-500/30',
      titleClass: 'text-amber-100',
      amountClass: 'text-amber-50',
      unitClass: 'text-amber-200/70',
      priceClass: 'text-amber-200/90',
    };
  }
  if (n.includes('r1') || index === 2) {
    return {
      background: 'linear-gradient(145deg, #0e1715 0%, #060d0b 100%)',
      borderColor: 'rgba(20, 184, 166, 0.22)',
      radialHighlight: 'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(20, 184, 166, 0.14), transparent 70%)',
      sheenOverlay:
        'linear-gradient(115deg, transparent 0%, rgba(20, 184, 166, 0.03) 40%, rgba(20, 184, 166, 0.06) 50%, transparent 100%)',
      kindClass: 'text-teal-300 border-teal-500/20 bg-teal-500/10',
      brandTextClass: 'text-teal-100',
      logoRing: 'ring-1 ring-teal-500/25',
      titleClass: 'text-teal-100',
      amountClass: 'text-teal-50',
      unitClass: 'text-teal-200/70',
      priceClass: 'text-teal-200/90',
    };
  }
  if (n.includes('qwen') || index === 1) {
    return {
      background: 'linear-gradient(145deg, #14121d 0%, #0a0912 100%)',
      borderColor: 'rgba(168, 85, 247, 0.22)',
      radialHighlight: 'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(168, 85, 247, 0.14), transparent 70%)',
      sheenOverlay:
        'linear-gradient(115deg, transparent 0%, rgba(168, 85, 247, 0.03) 40%, rgba(168, 85, 247, 0.06) 50%, transparent 100%)',
      kindClass: 'text-purple-300 border-purple-500/20 bg-purple-500/10',
      brandTextClass: 'text-purple-100',
      logoRing: 'ring-1 ring-purple-500/25',
      titleClass: 'text-purple-100',
      amountClass: 'text-purple-50',
      unitClass: 'text-purple-200/70',
      priceClass: 'text-purple-200/90',
    };
  }
  return {
    background: 'linear-gradient(145deg, #101622 0%, #080c14 100%)',
    borderColor: 'rgba(148, 163, 184, 0.22)',
    radialHighlight: 'radial-gradient(ellipse 70% 60% at 0% 0%, rgba(148, 163, 184, 0.14), transparent 70%)',
    sheenOverlay:
      'linear-gradient(115deg, transparent 0%, rgba(148, 163, 184, 0.03) 40%, rgba(148, 163, 184, 0.06) 50%, transparent 100%)',
    kindClass: 'text-slate-300 border-slate-400/20 bg-slate-400/10',
    brandTextClass: 'text-slate-100',
    logoRing: 'ring-1 ring-slate-400/25',
    titleClass: 'text-slate-100',
    amountClass: 'text-white',
    unitClass: 'text-slate-400',
    priceClass: 'text-slate-300',
  };
}

/** The plan as a physical metallic pass with tier-specific finishes. */
function PassCard({
  plan,
  kind,
  mode,
  index,
}: {
  plan: Plan;
  kind: string;
  mode: Mode;
  index: number;
}) {
  const mat = getTierMaterial(mode, index, plan.name);

  return (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden rounded-[22px] border p-6 sm:p-7 text-white shadow-inner"
      style={{
        background: mat.background,
        borderColor: mat.borderColor,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: mat.radialHighlight }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: mat.sheenOverlay }}
      />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <span className={`relative h-8 w-8 overflow-hidden rounded-lg ${mat.logoRing}`}>
            <Image src="/morphic-symbol.jpg" alt="" fill sizes="32px" className="object-cover scale-[1.9]" />
          </span>
          <span className={`text-sm font-semibold tracking-tight ${mat.brandTextClass}`}>Morphic</span>
        </span>
        <span
          className={`font-mono text-[10px] sm:text-[11px] tracking-[0.14em] uppercase font-medium px-2.5 py-0.5 rounded-full border backdrop-blur-sm ${mat.kindClass}`}
        >
          {kind}
        </span>
      </div>

      <div className="relative">
        <div className={`font-mono text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums ${mat.amountClass}`}>
          {plan.amount}
        </div>
        <div className={`mt-1 text-sm font-medium ${mat.unitClass}`}>{plan.unit}</div>
      </div>

      <div className="relative flex items-end justify-between gap-4 pt-2.5 border-t border-white/[0.08]">
        <div className="min-w-0">
          <span className={`block text-base font-semibold truncate ${mat.titleClass}`}>{plan.name}</span>
          <span className="block text-[10px] font-mono tracking-wider text-neutral-400 uppercase">Authorized Pass</span>
        </div>
        <span className={`font-mono text-sm sm:text-base font-semibold tabular-nums whitespace-nowrap ${mat.priceClass}`}>
          {plan.price}
        </span>
      </div>
    </div>
  );
}

/** Words that rise into place as the section scrolls in. */
function ScrollWords({ text, enter }: { text: string; enter: MotionValue<number> }) {
  return (
    <>
      {text.split(' ').map((w, i) => (
        <span key={`${w}-${i}`}>
          {i > 0 && ' '}
          <ScrollWord word={w} enter={enter} at={0.15 + i * 0.05} />
        </span>
      ))}
    </>
  );
}

function ScrollWord({ word, enter, at }: { word: string; enter: MotionValue<number>; at: number }) {
  const y = useTransform(enter, [at, at + 0.3], ['110%', '0%'], { clamp: true });
  return (
    <span className="inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-bottom">
      <motion.span className="inline-block" style={{ y }}>
        {word}
      </motion.span>
    </span>
  );
}

/** Holds one card's place in the fan: spread wide while the section enters, stacked once it lands. */
function FanSlot({ offset, zIndex, enter, children }: { offset: number; zIndex: number; enter: MotionValue<number>; children: ReactNode }) {
  const fan = useTransform(enter, [0.35, 1], [1, 0], { clamp: true });
  const x = useTransform(fan, (f) => `${offset * f * 62}%`);
  const rotate = useTransform(fan, (f) => offset * f * 9);
  const y = useTransform(fan, (f) => Math.abs(offset) * f * 30);
  return (
    <motion.div style={{ x, rotate, y, zIndex }} className="absolute inset-0">
      {children}
    </motion.div>
  );
}

export default function PricingPlans({ isLoggedIn = false, showPricingHubLink = true }: PricingPlansProps) {
  const { t, locale } = useTranslation();
  const en = locale === 'en';
  const [mode, setMode] = useState<Mode>('credits');
  // Index the user picked; null falls back to the tier the copy marks popular.
  const [picked, setPicked] = useState<number | null>(null);
  const targetUrl = isLoggedIn ? '/dashboard/billing' : '/login';

  // Scroll-linked entrance: 0 as the section's top meets the bottom of the screen, 1 once it is well in.
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: enterRaw } = useScroll({ target: sectionRef, offset: ['start end', 'start 0.15'] });
  const enter = useSpring(enterRaw, { stiffness: 140, damping: 32, mass: 0.35 });
  const descOpacity = useTransform(enter, [0.35, 0.7], [0, 1]);
  const descY = useTransform(enter, [0.35, 0.7], [16, 0]);
  const stageTilt = useTransform(enter, [0.3, 1], [32, 0]);
  const stageY = useTransform(enter, [0.3, 1], [80, 0]);
  const panelX = useTransform(enter, [0.5, 1], [60, 0]);
  const panelOpacity = useTransform(enter, [0.5, 0.9], [0, 1]);

  // Pointer tilt and a glare that follows the cursor across the front card.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, TILT_SPRING);
  const sy = useSpring(py, TILT_SPRING);
  const rotateY = useTransform(sx, [0, 1], [-12, 12]);
  const rotateX = useTransform(sy, [0, 1], [10, -10]);
  const glareX = useTransform(sx, (v) => `${v * 100}%`);
  const glareY = useTransform(sy, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, rgba(255,255,255,0.16), transparent 55%)`;

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onPointerLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  const plans: Plan[] =
    mode === 'credits'
      ? t.pricing.tiers.map((tier) => {
          const [, amount = tier.credits, unit = ''] = tier.credits.match(/^([\d.,]+)\s*(.*)$/) ?? [];
          return {
            name: tier.name,
            price: tier.price,
            amount,
            unit,
            desc: tier.desc,
            noteLabel: t.pricing.estimateLabel,
            note: tier.estimate,
            features: tier.features,
            badge: tier.popular ? t.pricing.popularBadge : undefined,
            cta: `${t.pricing.choosePlan} ${tier.name}`,
          };
        })
      : t.pricing.dailyTiers.map((pass) => ({
          name: pass.name,
          price: pass.price,
          amount: en ? '24 hours' : '24 jam',
          unit: en ? 'unlimited requests' : 'request tanpa batas',
          desc: pass.desc,
          features: en
            ? ['24 hours of access', 'Unlimited requests', 'Activated instantly by QRIS']
            : ['Akses 24 jam', 'Request tanpa batas', 'Aktif instan lewat QRIS'],
          badge: pass.popular ? t.pricing.bestValueBadge : undefined,
          cta: t.pricing.activatePass,
        }));

  const popularIdx = Math.max(0, plans.findIndex((p) => p.badge));
  const active = picked ?? popularIdx;
  const plan = plans[active];
  const kind = mode === 'credits' ? 'CREDIT PASS' : 'DAY PASS';

  const switchMode = (m: Mode) => {
    setMode(m);
    setPicked(null);
  };

  const tabs: { id: Mode; label: string }[] = [
    { id: 'credits', label: en ? 'Credit balance' : 'Saldo kredit' },
    { id: 'daily', label: en ? 'Daily pass' : 'Pass harian' },
  ];

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className={`relative z-10 bg-[#fafafa] px-4 sm:px-6 ${
        showPricingHubLink ? 'py-20 lg:py-28' : 'pt-28 pb-20 sm:pt-36 sm:pb-24 lg:pt-40 lg:pb-28'
      } scroll-mt-20`}
    >
      <div className="mx-auto max-w-5xl">
        <div
          className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
        >
          <div className="max-w-xl">
            <p suppressHydrationWarning className="mb-3 text-sm font-medium text-neutral-500">
              {t.pricing.badge}
            </p>
            <h2 suppressHydrationWarning className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 text-balance">
              <ScrollWords key={t.pricing.title} text={t.pricing.title} enter={enter} />
            </h2>
            <motion.p suppressHydrationWarning style={{ opacity: descOpacity, y: descY }} className="mt-4 text-base leading-relaxed text-neutral-600">
              {t.pricing.desc}
            </motion.p>
          </div>

          <div role="tablist" aria-label={en ? 'Billing mode' : 'Mode pembayaran'} className="inline-flex shrink-0 self-start rounded-full border border-neutral-200 bg-white p-1 md:self-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                aria-controls="pricing-panel"
                onClick={() => switchMode(tab.id)}
                className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 ${
                  mode === tab.id ? 'text-white' : 'text-neutral-600 hover:text-neutral-950'
                }`}
              >
                {mode === tab.id && (
                  <motion.span
                    layoutId="pricing-tab"
                    className="absolute inset-0 rounded-full bg-neutral-950"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="relative">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
        >
          {/* Card stack: the picked pass comes to the front, the rest fan out behind it. */}
          <div className="mx-auto w-full max-w-[440px]">
            <div onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className="pt-16 [perspective:1400px]">
              <motion.div style={{ rotateX: stageTilt, y: stageY }} className="[transform-style:preserve-3d]">
              <motion.div style={{ rotateX, rotateY }} className="relative aspect-[1.586/1] w-full [transform-style:preserve-3d]">
                {plans.map((p, i) => {
                  const rel = (i - active + plans.length) % plans.length;
                  const front = rel === 0;
                  return (
                    <FanSlot key={`${mode}-${p.name}`} zIndex={10 - rel} offset={i - (plans.length - 1) / 2} enter={enter}>
                    <motion.button
                      key={`${mode}-${p.name}`}
                      type="button"
                      tabIndex={-1}
                      aria-hidden={!front}
                      onClick={() => setPicked(i)}
                      initial={{ opacity: 0, y: 40, scale: 0.9 }}
                      animate={{
                        y: rel * -22,
                        scale: 1 - rel * 0.06,
                        opacity: rel > 2 ? 0 : 1,
                        filter: rel === 0 ? 'brightness(1)' : 'brightness(0.82)',
                        rotateZ: rel === 0 ? 0 : rel % 2 ? -2.5 : 2.5,
                      }}
                      transition={STACK_SPRING}
                      className={`absolute inset-0 text-left ${front ? 'cursor-default' : 'cursor-pointer'} ${
                        front ? 'shadow-[0_30px_60px_-24px_rgba(10,10,10,0.55)]' : 'shadow-[0_12px_28px_-10px_rgba(0,0,0,0.4)]'
                      } rounded-[22px]`}
                    >
                      <PassCard plan={p} kind={kind} mode={mode} index={i} />
                      {front && (
                        <motion.span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-[22px]"
                          style={{ background: glare }}
                        />
                      )}
                    </motion.button>
                    </FanSlot>
                  );
                })}
              </motion.div>
              </motion.div>
            </div>

            <div role="radiogroup" aria-label={en ? 'Plans' : 'Paket'} className="mt-8 flex flex-wrap justify-center gap-1.5">
              {plans.map((p, i) => {
                const on = i === active;
                return (
                  <button
                    key={`${mode}-pick-${p.name}`}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPicked(i)}
                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 ${
                      on ? 'text-white' : 'text-neutral-600 hover:text-neutral-950'
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId={`pricing-pick-${mode}`}
                        className="absolute inset-0 rounded-full bg-neutral-950"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <span className="relative">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details for the card in front. */}
          <motion.div id="pricing-panel" role="tabpanel" aria-live="polite" style={{ x: panelX, opacity: panelOpacity }}>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-neutral-950">{plan.name}</span>
              {plan.badge && <span className="rounded-md bg-neutral-950 px-2 py-0.5 text-xs font-semibold text-white">{plan.badge}</span>}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-heading text-5xl sm:text-6xl font-extrabold tracking-tight text-neutral-950">
                <RollingPrice price={plan.price} locale={locale} />
              </span>
              {mode === 'daily' && <span className="text-neutral-500">{t.pricing.perDay}</span>}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${mode}-${plan.name}`}
                initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-neutral-600">{plan.desc}</p>

                {plan.note && (
                  <div className="mt-6 rounded-2xl bg-neutral-100 px-4 py-3.5">
                    <div className="text-[12px] text-neutral-500">{plan.noteLabel}</div>
                    <div className="mt-1 text-sm leading-relaxed text-neutral-800">{plan.note}</div>
                  </div>
                )}

                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f, i) => (
                    <motion.li
                      key={f}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.06 + i * 0.05, ease: EASE }}
                      className="flex items-start gap-3 text-sm text-neutral-800"
                    >
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-neutral-950">
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                      </span>
                      <span suppressHydrationWarning>{f}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href={targetUrl}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-7 py-3.5 text-sm font-bold text-white transition-[background-color,transform] duration-300 hover:bg-neutral-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
              >
                <span suppressHydrationWarning>{plan.cta}</span>
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              {showPricingHubLink && (
                <Link
                  href="/pricing"
                  className="group inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-950"
                >
                  {en ? 'Full pricing and calculator' : 'Harga lengkap dan kalkulator'}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
