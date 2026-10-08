'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { API_BASE_URL } from '@/lib/utils';

// Closing scene: every model the page has shown spirals into a single key as you scroll.
// Real marks only (vendored LobeHub SVGs, see public/logos/README.md).
const LOGOS = [
  ['OpenAI', '/logos/openai.svg'],
  ['Gemini', '/logos/gemini-color.svg'],
  ['Claude', '/logos/claude-color.svg'],
  ['Grok', '/logos/grok.svg'],
  ['Llama', '/logos/meta-color.svg'],
  ['Mistral', '/logos/mistral-color.svg'],
  ['DeepSeek', '/logos/deepseek-color.svg'],
  ['Qwen', '/logos/qwen-color.svg'],
  ['Kimi', '/logos/kimi-color.svg'],
  ['GLM', '/logos/zhipu-color.svg'],
  ['MiniMax', '/logos/minimax-color.svg'],
  ['Yi', '/logos/yi.svg'],
] as const;

const N = LOGOS.length;
const window_ = (i: number): [number, number] => [0.04 + i * 0.04, 0.3 + i * 0.04]; // last ends at 0.74
const easeIn = (t: number) => t * t * t;

/** One logo on its spiral: far out on the ring at first, swallowed by the key at the end. */
function Orbiter({ i, progress, rx, ry }: { i: number; progress: MotionValue<number>; rx: MotionValue<number>; ry: MotionValue<number> }) {
  const [s, e] = window_(i);
  const a0 = (i / N) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.18 : -0.12);
  const depth = 1 + (i % 3) * 0.1;
  const t = useTransform(progress, (p) => easeIn(Math.min(1, Math.max(0, (p - s) / (e - s)))));
  const x = useTransform([t, rx], ([tt, r]: number[]) => Math.cos(a0 + tt * 1.4) * r * depth * (1 - tt));
  const y = useTransform([t, ry], ([tt, r]: number[]) => Math.sin(a0 + tt * 1.4) * r * depth * (1 - tt));
  const scale = useTransform(t, [0, 1], [1, 0.25]);
  const opacity = useTransform(t, [0, 0.8, 1], [1, 1, 0]);
  const [label, src] = LOGOS[i];

  return (
    <motion.div
      style={{ x, y, scale, opacity }}
      className="absolute left-1/2 top-1/2 -ml-7 -mt-7 grid h-14 w-14 place-items-center rounded-full border border-neutral-200 bg-white shadow-[0_10px_30px_-12px_rgba(10,10,10,0.25)] will-change-transform"
    >
      <Image src={src} alt={label} width={28} height={28} unoptimized className="h-7 w-7" />
    </motion.div>
  );
}

function KeyChip({ count, grow }: { count: number; grow: MotionValue<number> | number }) {
  return (
    <motion.div
      style={{ scale: grow }}
      className="relative flex items-center gap-3 rounded-full bg-[#0a0a0a] py-3 pl-3 pr-6 text-white shadow-[0_24px_60px_-20px_rgba(10,10,10,0.6)]"
    >
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
        <Image src="/morphic-symbol.jpg" alt="" fill sizes="40px" className="object-cover scale-[1.9]" />
      </span>
      <span className="font-mono text-base sm:text-lg tracking-wide">mp-••••••••</span>
      <span className="ml-2 rounded-full bg-white/10 px-2.5 py-1 font-mono text-xs tabular-nums text-neutral-300">
        {count} {count === 1 ? 'model' : 'models'}
      </span>
    </motion.div>
  );
}

function CopyUrl({ en }: { en: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(API_BASE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the URL stays visible to copy by hand.
    }
  };
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2.5 rounded-full border border-neutral-300 bg-white px-5 py-3 font-mono text-sm font-semibold text-neutral-950 transition-[border-color,transform] duration-300 hover:border-neutral-950 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span aria-live="polite">{copied ? (en ? 'Copied' : 'Tersalin') : API_BASE_URL}</span>
      </button>
      <Link href="/docs" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-950">
        {en ? 'Read the setup guide' : 'Baca panduan setup'}
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  );
}

function Word({ word, progress, at }: { word: string; progress: MotionValue<number>; at: number }) {
  const y = useTransform(progress, [at, at + 0.06], ['110%', '0%'], { clamp: true });
  return (
    <span className="inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-bottom">
      <motion.span className="inline-block" style={{ y }}>
        {word}
      </motion.span>
    </span>
  );
}

export default function ClosingKey() {
  const { locale } = useTranslation();
  const en = locale === 'en';
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.35, restDelta: 0.0002 });
  const rx = useMotionValue(420);
  const ry = useMotionValue(280);
  const [count, setCount] = useState(0);

  // The orbit is an ellipse sized to the stage: wide on desktop, tall on phones.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      rx.set(Math.min(width * 0.36 - 20, 560));
      ry.set(height * 0.32);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rx, ry]);

  useMotionValueEvent(progress, 'change', (p) => {
    setCount(LOGOS.reduce((n, _, i) => n + (p >= window_(i)[1] - 0.04 ? 1 : 0), 0));
  });

  const grow = useTransform(progress, [0.04, 0.74, 0.8], [0.9, 1.12, 1.05]);
  const keyY = useTransform(progress, [0.72, 0.86], [0, -150]);
  const ctaOpacity = useTransform(progress, [0.86, 0.94], [0, 1]);
  const ctaY = useTransform(progress, [0.86, 0.94], [16, 0]);

  const lines = en ? ['Every model.', 'One key.'] : ['Semua model.', 'Satu key.'];

  let wordIndex = 0;
  return (
    <section className="relative bg-white" aria-labelledby="closing-title">
      <div ref={trackRef} className="relative h-[260vh]">
        <div ref={stageRef} className="sticky top-0 h-[100svh] overflow-hidden">
          {LOGOS.map(([label], i) => (
            <Orbiter key={label} i={i} progress={progress} rx={rx} ry={ry} />
          ))}

          <div className="absolute inset-0 flex items-center justify-center px-4">
            <motion.div style={{ y: keyY }}>
              <KeyChip count={count} grow={grow} />
            </motion.div>
          </div>

          {/* Headline and action take the space the key rises out of. */}
          <div className="absolute inset-x-0 top-[calc(50%-80px)] flex flex-col items-center px-4">
            <h2 id="closing-title" className="text-center font-heading text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight">
              {lines.map((line, li) => (
                <span key={line} className={`block ${li === 1 ? 'text-neutral-400' : 'text-neutral-950'}`}>
                  {line.split(' ').map((w, i) => {
                    const at = 0.74 + wordIndex++ * 0.04;
                    return (
                      <span key={`${w}-${i}`}>
                        {i > 0 && ' '}
                        <Word word={w} progress={progress} at={at} />
                      </span>
                    );
                  })}
                </span>
              ))}
            </h2>

            <motion.div style={{ opacity: ctaOpacity, y: ctaY }} className="mt-10">
              <CopyUrl en={en} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
