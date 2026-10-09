'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  animate,
  AnimatePresence,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { API_BASE_URL } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

const ROUTER_MODELS = [
  { id: 'deepseek-v4', provider: 'DeepSeek', costId: '64K konteks', costEn: '64K context' },
  { id: 'kimi-coding', provider: 'Moonshot', costId: '256K konteks', costEn: '256K context' },
  { id: 'qwen-max', provider: 'Alibaba', costId: '32K konteks', costEn: '32K context' },
  { id: 'DeepSeek-V4-Flash-0731', provider: 'DeepSeek', costId: '64K konteks', costEn: '64K context' },
];

// The two checkout paths the API accepts: QRIS via Duitku, and PayPal.
const PAY_METHODS = ['QRIS', 'PayPal'];

/** Reveals `text` a few characters per frame; returns the visible prefix. */
function useTyped(text: string, cps = 90) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const next = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * cps));
      setN(next);
      if (next < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, cps]);
  return text.slice(0, n);
}

// A QR-looking 21x21 matrix: three finder squares plus seeded noise. Decorative, never scannable.
const QR = (() => {
  const size = 21;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) =>
    x < 7 && y < 7 ? [x, y] : x >= size - 7 && y < 7 ? [x - size + 7, y] : x < 7 && y >= size - 7 ? [x, y - size + 7] : null;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const f = finder(x, y);
      if (f) {
        const [fx, fy] = f;
        const ring = fx === 0 || fy === 0 || fx === 6 || fy === 6;
        const core = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
        if (ring || core) cells.push([x, y]);
      } else if (!(x < 8 && y < 8) && !(x >= size - 8 && y < 8) && !(x < 8 && y >= size - 8) && rnd() > 0.52) {
        cells.push([x, y]);
      }
    }
  return { size, cells };
})();

function TopUpPreview({ locale }: { locale: string }) {
  const [paid, setPaid] = useState(false);
  const tokens = useMotionValue(0);
  const tokensText = useTransform(tokens, (v) => Math.round(v).toLocaleString('id-ID'));

  useEffect(() => {
    if (!paid) return;
    const c = animate(tokens, 5_000_000, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [paid, tokens]);

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="relative h-28 w-28 sm:h-36 sm:w-36 shrink-0 overflow-hidden rounded-2xl bg-white p-2.5 sm:p-3">
        <svg viewBox={`0 0 ${QR.size} ${QR.size}`} className="h-full w-full" shapeRendering="crispEdges" aria-hidden="true">
          {QR.cells.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a0a0a" />
          ))}
        </svg>
        {!paid && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent to-neutral-950/25 border-b-2 border-neutral-950"
            initial={{ top: '-25%' }}
            animate={{ top: '100%' }}
            transition={{ duration: 1.5, delay: 0.3, ease: [0.65, 0, 0.35, 1] }}
            onAnimationComplete={() => setPaid(true)}
          />
        )}
        <AnimatePresence>
          {paid && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-[2px]"
            >
              <motion.span
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="grid h-12 w-12 place-items-center rounded-full bg-neutral-950"
              >
                <Check className="h-6 w-6 text-white" strokeWidth={3} />
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="min-w-0 flex-1">
        {/* The cheapest pack the store actually sells (see db seed). */}
        <div className="text-sm text-neutral-400">5M Token Starter · Rp 5.000</div>
        <div className="mt-1 font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-white">
          <motion.span>{tokensText}</motion.span>
        </div>
        <div className="text-[13px] text-neutral-500">
          {paid
            ? locale === 'en' ? 'tokens credited' : 'token masuk ke saldo'
            : locale === 'en' ? 'scanning…' : 'memindai…'}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PAY_METHODS.map((m) => (
            <span key={m} className="rounded-md border border-white/12 px-1.5 py-0.5 text-[11px] text-neutral-300">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const KEY_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function KeyPreview({ locale }: { locale: string }) {
  const final = 'mp-••••••••••••••••';
  const [shown, setShown] = useState('mp-');

  // Scramble left to right, then settle on the masked form the dashboard shows.
  useEffect(() => {
    const len = final.length - 3;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const settled = Math.floor((performance.now() - start) / 55);
      let s = 'mp-';
      for (let i = 0; i < len; i++) s += i < settled ? '•' : KEY_CHARS[(Math.random() * KEY_CHARS.length) | 0];
      setShown(s);
      if (settled < len) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div>
      <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
        <div className="mb-2 text-[12px] text-neutral-500">{locale === 'en' ? 'New key · Cursor' : 'Key baru · Cursor'}</div>
        <div className="font-mono text-lg tracking-wide text-white break-all">{shown}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {['Production', 'Staging'].map((name, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 + i * 0.12, ease: EASE }}
            className="rounded-xl border border-white/10 px-3 py-2.5"
          >
            <div className="text-[13px] font-medium text-white">{name}</div>
            <div className="font-mono text-[12px] text-neutral-500">mp-••••••••</div>
          </motion.div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-neutral-500">
        {locale === 'en'
          ? 'One key per tool. Revoke one without touching the others.'
          : 'Satu key per tool. Revoke satu tanpa ganggu yang lain.'}
      </p>
    </div>
  );
}

/** Light syntax pass: quoted strings in white, keywords dimmed, the rest neutral. */
function Code({ text }: { text: string }) {
  return (
    <>
      {text.split(/("[^"\n]*"?)/g).map((part, i) =>
        part.startsWith('"') ? (
          <span key={i} className="text-white">{part}</span>
        ) : (
          <span key={i}>
            {part.split(/\b(from|import)\b/g).map((p, j) =>
              p === 'from' || p === 'import' ? <span key={j} className="text-neutral-600">{p}</span> : p,
            )}
          </span>
        ),
      )}
    </>
  );
}

function ConnectPreview() {
  const [tab, setTab] = useState<'python' | 'ide'>('python');
  const source =
    tab === 'python'
      ? `from openai import OpenAI\n\nclient = OpenAI(\n  base_url="${API_BASE_URL}",\n  api_key="mp-…",\n)`
      : `{\n  "override_base_url": "${API_BASE_URL}",\n  "api_key": "mp-…",\n  "model": "deepseek-v4"\n}`;
  const typed = useTyped(source, 110);
  const typing = typed.length < source.length;

  return (
    <div>
      <div className="mb-4 inline-flex rounded-full border border-white/10 p-1" role="tablist">
        {(['python', 'ide'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`relative rounded-full px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              tab === k ? 'text-neutral-950' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {tab === k && (
              <motion.span layoutId="connect-tab" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
            )}
            <span className="relative">{k === 'python' ? 'Python SDK' : 'Cursor / IDE'}</span>
          </button>
        ))}
      </div>
      <pre className="min-h-[150px] overflow-x-auto font-mono text-[13px] leading-6 text-neutral-400" aria-label={source}>
        <Code text={typed} />
        {typing && <span className="ml-px inline-block h-4 w-[7px] translate-y-[3px] bg-white" aria-hidden="true" />}
      </pre>
    </div>
  );
}

const STREAM = ['def', ' binary_search', '(arr,', ' target):', '\n    lo, hi', ' = 0,', ' len(arr)', ' - 1'];

function RoutePreview({ locale }: { locale: string }) {
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(0);
  const cur = ROUTER_MODELS[idx];

  // Restart the token stream whenever the model changes.
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= STREAM.length) window.clearInterval(id);
    }, 120);
    return () => window.clearInterval(id);
  }, [idx]);

  const pick = (i: number) => {
    setCount(0);
    setIdx(i);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ROUTER_MODELS.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => pick(i)}
            aria-pressed={i === idx}
            className={`rounded-full border px-3 py-1 font-mono text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              i === idx ? 'border-white bg-white text-neutral-950' : 'border-white/12 text-neutral-400 hover:border-white/30 hover:text-white'
            }`}
          >
            {m.id}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 font-mono text-[12px] text-neutral-500">
        <span>model={cur.id}</span>
        <span>→</span>
        <span className="text-white">{cur.provider}</span>
        <span className="ml-auto">{locale === 'en' ? cur.costEn : cur.costId}</span>
      </div>
      <pre className="mt-3 min-h-[92px] rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-[13px] leading-6 text-white whitespace-pre-wrap">
        {STREAM.slice(0, count).map((tok, i) => (
          <motion.span
            key={`${idx}-${i}`}
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.3 }}
          >
            {tok}
          </motion.span>
        ))}
      </pre>
    </div>
  );
}

/** Dark stage for the previews. The border lights up under the pointer. */
function StepPanel({ num, total, children }: { num: number; total: number; children: ReactNode }) {
  const mx = useMotionValue(-999);
  const my = useMotionValue(-999);
  const border = useMotionTemplate`radial-gradient(360px circle at ${mx}px ${my}px, rgba(255,255,255,0.55), rgba(255,255,255,0.08) 60%)`;
  return (
    <motion.div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onPointerLeave={() => {
        mx.set(-999);
        my.set(-999);
      }}
      style={{ background: border }}
      className="rounded-[26px] p-px"
    >
      <div className="relative isolate overflow-hidden rounded-[25px] bg-[#0a0a0a] p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,255,255,0.09), transparent 70%)' }}
        />
        <div className="mb-5 flex items-center gap-3">
          <span className="font-mono text-[12px] text-neutral-400">
            0{num + 1} / 0{total}
          </span>
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/12">
                <motion.span
                  className="block h-full origin-left bg-white"
                  initial={false}
                  animate={{ scaleX: i <= num ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              </span>
            ))}
          </div>
        </div>
        <div className="min-h-[200px]">{children}</div>
      </div>
    </motion.div>
  );
}

type Step = { num: string; title: string; desc: string; note?: string; preview: ReactNode };

/**
 * One frame of the film strip. Its distance from the centre of the viewport (in frames)
 * sets how present it is: the centred frame is full size, neighbours shrink and fade,
 * and the giant numeral drifts against the scroll for depth.
 */
function Frame({
  index,
  frames,
  progress,
  children,
  numeral,
}: {
  index: number;
  frames: number;
  progress: MotionValue<number>;
  children: ReactNode;
  numeral?: string;
}) {
  const offset = useTransform(progress, (p) => p * (frames - 1) - index);
  const near = useTransform(offset, (o) => Math.min(1, Math.abs(o)));
  const scale = useTransform(near, [0, 1], [1, 0.9]);
  const opacity = useTransform(near, [0, 1], [1, 0.35]);
  const numeralX = useTransform(offset, [-1, 1], [-160, 160]);
  return (
    <motion.div style={{ scale, opacity }} className="relative h-full will-change-transform w-[88vw] shrink-0 md:w-[76vw] lg:w-[68vw] max-w-[1040px]">
      {numeral && (
        <motion.span
          aria-hidden="true"
          style={{ x: numeralX, WebkitTextStroke: '1.5px #d4d4d4', willChange: 'transform' }}
          className="pointer-events-none absolute -top-6 right-0 select-none font-heading text-[9rem] sm:text-[13rem] lg:text-[17rem] font-extrabold leading-none tracking-tighter text-transparent"
        >
          {numeral}
        </motion.span>
      )}
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
}

export default function HowItWorksSteps() {
  const { t, locale } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0); // frame index, 0 is the intro
  const [seen, setSeen] = useState(0); // furthest step reached, so previews mount as they arrive
  const travel = useMotionValue(0);

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  // Softer spring than elsewhere: the strip glides a touch behind the wheel instead of stepping with it.
  const progress = useSpring(
    scrollYProgress,
    isMobile
      ? { stiffness: 80, damping: 24, mass: 0.4, restDelta: 0.002 }
      : { stiffness: 80, damping: 24, mass: 0.5, restDelta: 0.0002 }
  );

  const steps: Step[] = [
    {
      num: t.steps.step1Num,
      title: t.steps.step1Title,
      desc: t.steps.step1Desc,
      note: locale === 'en' ? 'QRIS for local payment, PayPal for cards from anywhere.' : 'QRIS untuk pembayaran lokal, PayPal untuk kartu dari mana saja.',
      preview: <TopUpPreview locale={locale} />,
    },
    {
      num: t.steps.step2Num,
      title: t.steps.step2Title,
      desc: t.steps.step2Desc,
      note: locale === 'en' ? 'Up to 5 keys per account. Revoke any of them in one click.' : 'Hingga 5 key per akun. Revoke yang mana saja sekali klik.',
      preview: <KeyPreview locale={locale} />,
    },
    {
      num: t.steps.step3Num,
      title: t.steps.step3Title,
      desc: t.steps.step3Desc,
      note: `Base URL: ${API_BASE_URL}`,
      preview: <ConnectPreview />,
    },
    {
      num: t.steps.step4Num,
      title: t.steps.step4Title,
      desc: t.steps.step4Desc,
      preview: <RoutePreview locale={locale} />,
    },
  ];
  const frames = steps.length + 1;

  // How far the strip slides: from the first frame's centre to the last frame's centre.
  // (scrollWidth would drop the strip's end padding in a flex row and leave the last frame off-centre.)
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => {
      const kids = strip.children as HTMLCollectionOf<HTMLElement>;
      const first = kids[0];
      const last = kids[kids.length - 1];
      if (!first || !last) return;
      const centre = (el: HTMLElement) => el.offsetLeft + el.offsetWidth / 2;
      travel.set(Math.max(0, centre(last) - centre(first)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(strip);
    measure();
    return () => ro.disconnect();
  }, [travel]);

  // Scroll is split into one slot per frame. In each slot the strip moves for the last
  // MOVE share and holds still for the rest, so every frame (the last one included)
  // sits centred long enough to read before the next arrives or the page moves on.
  const MOVE = 0.6;
  // Inside each slot the move follows a smootherstep curve: it eases out of the hold and
  // settles into the next one, with no velocity jump at either end.
  const strip = useTransform(progress, (p) => {
    const slot = Math.min(frames - 1e-6, Math.max(0, p) * frames);
    const i = Math.floor(slot);
    if (i >= frames - 1) return 1;
    const t = Math.max(0, (slot - i - (1 - MOVE)) / MOVE);
    const eased = t * t * t * (t * (t * 6 - 15) + 10);
    return (i + eased) / (frames - 1);
  });

  const x = useTransform([strip, travel], ([p, d]: number[]) => -p * d);
  const railFill = useTransform(strip, [1 / (frames - 1) - 0.12, 1], [0, 1], { clamp: true });
  const introOut = useTransform(strip, [0, 0.12], [1, 0]);

  useMotionValueEvent(strip, 'change', (p) => {
    const f = Math.round(p * (frames - 1));
    setActive(f);
    setSeen((s) => Math.max(s, f));
  });

  const jumpTo = (step: number) => {
    const el = trackRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    // Land in the middle of that frame's hold.
    const at = (step + 1 + (1 - MOVE) / 2) / frames;
    window.scrollTo({ top: top + at * (el.offsetHeight - window.innerHeight), behavior: 'smooth' });
  };

  const header = (
    <h2 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-neutral-950 text-balance">
      {t.steps.title}
    </h2>
  );

  return (
    <section id="integration" className="relative z-10 bg-[#fafafa] scroll-mt-20">
      <div ref={trackRef} className="relative h-[360vh] md:h-[560vh]">
        <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden pt-20 pb-6">
          {/* The strip: an intro frame, then one frame per step. Vertical scroll slides it sideways. */}
          <motion.div ref={stripRef} style={{ x }} className="flex min-h-0 flex-1 items-stretch gap-6 px-[6vw] md:px-[12vw] lg:px-[calc((100vw-min(68vw,1040px))/2)] will-change-transform">
            <Frame index={0} frames={frames} progress={strip}>
              <motion.div style={{ opacity: introOut }} className="flex h-full flex-col justify-center">
                {header}
                <p className="mt-6 max-w-xl text-lg sm:text-xl leading-relaxed text-neutral-600">{t.steps.desc}</p>
                <p className="mt-10 flex items-center gap-3 text-sm font-medium text-neutral-500">
                  <span className="h-px w-10 bg-neutral-400" aria-hidden="true" />
                  {locale === 'en' ? 'Keep scrolling' : 'Terus scroll'}
                </p>
              </motion.div>
            </Frame>

            {steps.map((s, i) => (
              <Frame key={s.num} index={i + 1} frames={frames} progress={strip} numeral={s.num}>
                <div className="grid h-full grid-cols-1 content-center gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12">
                  <div className="relative">
                    <span className="font-mono text-sm text-neutral-500">
                      {locale === 'en' ? 'Step' : 'Langkah'} {s.num}
                    </span>
                    <h3 className="mt-2 font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 text-balance">
                      {s.title}
                    </h3>
                    <p className="mt-3 text-[15px] sm:text-lg leading-relaxed text-neutral-600">{s.desc}</p>
                    {s.note && <p className="mt-3 hidden text-sm text-neutral-500 break-words sm:block">{s.note}</p>}
                  </div>
                  <StepPanel num={i} total={steps.length}>
                    {/* Each preview mounts when its frame first arrives, so its animation plays in view. */}
                    {seen >= i + 1 ? s.preview : null}
                  </StepPanel>
                </div>
              </Frame>
            ))}
          </motion.div>

          {/* Progress rail: one line that fills across the steps; each stop jumps to its frame. */}
          <div className="mx-auto mt-4 w-full max-w-3xl px-6">
            <div className="relative h-px bg-neutral-200">
              <motion.div style={{ scaleX: railFill }} className="absolute inset-0 origin-left bg-neutral-950" />
            </div>
            <div className="mt-3 grid grid-cols-4">
              {steps.map((s, i) => {
                const on = active === i + 1;
                const done = active > i + 1;
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => jumpTo(i)}
                    aria-current={on ? 'step' : undefined}
                    className={`truncate rounded px-1 text-left text-xs sm:text-sm font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${
                      on ? 'text-neutral-950' : done ? 'text-neutral-600' : 'text-neutral-400 hover:text-neutral-700'
                    }`}
                  >
                    <span className="font-mono">{s.num}</span>
                    <span className="hidden sm:inline"> {s.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
