'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useTranslation } from '@/lib/i18n';

// One drawing, read top to bottom: every model's line bends into the Morphic gateway,
// then a single line runs down through what the gateway does and ends at your app.
// Scroll is the timeline; a "camera" pans the drawing so the moving tips stay near the
// middle of the pinned viewport. No SVG filters: every frame repaints the strokes, and
// blur filters are what make that expensive.

const INK = '#0a0a0a';
const RAIL = '#ececec';
const BORDER = '#e5e5e5';
const LABEL_GAP = 52; // keeps the outgoing line clear of the gateway label
const TAIL_PX = 42; // comet tail length in drawing units

// Real marks only (vendored LobeHub SVGs, see public/logos/README.md).
const MODELS = [
  { label: 'OpenAI', logo: '/logos/openai.svg' },
  { label: 'Gemini', logo: '/logos/gemini-color.svg' },
  { label: 'Claude', logo: '/logos/claude-color.svg' },
  { label: 'Grok', logo: '/logos/grok.svg' },
  { label: 'Llama', logo: '/logos/meta-color.svg' },
  { label: 'Mistral', logo: '/logos/mistral-color.svg' },
  { label: 'DeepSeek', logo: '/logos/deepseek-color.svg' },
  { label: 'Qwen', logo: '/logos/qwen-color.svg' },
  { label: 'Kimi', logo: '/logos/kimi-color.svg' },
  { label: 'GLM', logo: '/logos/zhipu-color.svg' },
  { label: 'MiniMax', logo: '/logos/minimax-color.svg' },
  { label: 'Yi', logo: '/logos/yi.svg' },
];

type Seg = { d: string; range: [number, number] };
type ModelNodeGeo = { x: number; y: number; appear: [number, number] };
type Geo = {
  w: number;
  h: number;
  cx: number;
  r: number;
  labelY: number;
  nodes: ModelNodeGeo[];
  inbound: Seg[];
  gateY: number;
  gate: number;
  spine: Seg;
  checks: { y: number; at: number }[];
  endY: number;
  cameraAt: number[];
  focus: number[];
};

const GATE_IN: [number, number] = [0.3, 0.42];
const GATE_PULSE: [number, number] = [0.42, 0.52];
const SPINE: [number, number] = [0.52, 0.9];
const END_IN: [number, number] = [0.9, 0.95];

function build({
  w,
  r,
  points,
  gateY,
  gate,
  endY,
  bend,
  checksY,
  labelY,
  focus,
}: {
  w: number;
  r: number;
  points: { x: number; y: number }[];
  gateY: number;
  gate: number;
  endY: number;
  bend: number;
  checksY: number[];
  labelY: number;
  focus: number[];
}): Geo {
  const cx = w / 2;
  const gateTop = gateY - gate / 2;
  const spineTop = gateY + gate / 2 + LABEL_GAP;
  const spineEnd = endY - 34;
  const tipAt = (y: number) => SPINE[0] + ((y - spineTop) / (spineEnd - spineTop)) * (SPINE[1] - SPINE[0]);
  return {
    w,
    h: endY + 130,
    cx,
    r,
    labelY,
    nodes: points.map((p, i) => ({ ...p, appear: [0.01 + i * 0.008, 0.07 + i * 0.008] })),
    // Left to right sweep, each line ending at the gateway's top edge.
    inbound: points.map((p, i) => ({
      d: `M${p.x} ${p.y + r} C ${p.x} ${p.y + r + bend}, ${cx} ${gateTop - bend * 1.6}, ${cx} ${gateTop}`,
      range: [0.1 + i * 0.012, 0.28 + i * 0.012] as [number, number],
    })),
    gateY,
    gate,
    spine: { d: `M${cx} ${spineTop} V${spineEnd}`, range: SPINE },
    checks: checksY.map((y) => ({ y, at: tipAt(y) })),
    endY,
    cameraAt: [0, 0.1, 0.32, 0.52, 0.9, 1],
    focus,
  };
}

function desktopGeo(): Geo {
  // Models sit on a wide arc above the gateway.
  const points = MODELS.map((_, i) => {
    const a = ((165 - (i * 150) / (MODELS.length - 1)) * Math.PI) / 180;
    return { x: Math.round(500 + 430 * Math.cos(a)), y: Math.round(600 - 330 * Math.sin(a)) };
  });
  return build({
    w: 1000,
    r: 28,
    points,
    gateY: 1040,
    gate: 140,
    endY: 2010,
    bend: 150,
    checksY: [1360, 1560, 1760],
    labelY: 150,
    focus: [430, 430, 1040, 1040, 1900, 2010],
  });
}

// Phones: the models in a 4 by 3 grid, then the same single spine.
function mobileGeo(): Geo {
  const cols = [62, 154, 246, 338];
  const rows = [250, 350, 450];
  const points = MODELS.map((_, i) => ({ x: cols[i % 4], y: rows[Math.floor(i / 4)] + (i % 2) * 16 }));
  return build({
    w: 400,
    r: 22,
    points,
    gateY: 780,
    gate: 112,
    endY: 1640,
    bend: 90,
    checksY: [1060, 1240, 1420],
    labelY: 150,
    focus: [400, 400, 780, 780, 1540, 1640],
  });
}

const MOBILE_QUERY = '(max-width: 767px)';
function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(MOBILE_QUERY);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

/** Faint rail, the inked stretch drawn by scroll, and a comet riding the tip. */
function Route({ seg, progress }: { seg: Seg; progress: MotionValue<number> }) {
  const drawn = useTransform(progress, seg.range, [0, 1], { clamp: true });
  const pathRef = useRef<SVGPathElement>(null);
  const cometRef = useRef<SVGGElement>(null);
  // Points along the path, sampled once. Reading geometry during scroll (getPointAtLength)
  // between transform writes forced a layout per dot per frame; a lookup table reads nothing.
  const lutRef = useRef<{ pts: Float32Array; len: number } | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const n = Math.max(2, Math.ceil(len / 4));
    const pts = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const p = path.getPointAtLength((i / (n - 1)) * len);
      pts[i * 2] = p.x;
      pts[i * 2 + 1] = p.y;
    }
    lutRef.current = { pts, len };
  }, [seg.d]);

  // Head follows the tip via the lookup table; the tail is a short dash of the same path.
  const tail = useTransform(drawn, (v) => (lutRef.current ? Math.min(v, TAIL_PX / lutRef.current.len) : 0));
  const tailOffset = useTransform([drawn, tail], ([v, t]: number[]) => Math.max(0, v - t));
  const cometOpacity = useTransform(drawn, (v) => (v > 0.001 && v < 0.999 ? 1 : 0));

  useMotionValueEvent(drawn, 'change', (v) => {
    const head = cometRef.current;
    const lut = lutRef.current;
    if (!head || !lut || v <= 0.001 || v >= 0.999) return;
    const { pts } = lut;
    const last = pts.length / 2 - 1;
    const f = v * last;
    const i = Math.min(last - 1, Math.floor(f));
    const t = f - i;
    const x = pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * t;
    const y = pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * t;
    head.setAttribute('transform', `translate(${x} ${y})`);
  });

  return (
    <g>
      <motion.path ref={pathRef} d={seg.d} stroke={INK} strokeWidth={1.5} fill="none" style={{ pathLength: drawn }} />
      <motion.g style={{ opacity: cometOpacity }}>
        <motion.path
          d={seg.d}
          stroke={INK}
          strokeWidth={3}
          strokeLinecap="round"
          strokeOpacity={0.35}
          fill="none"
          style={{ pathLength: tail, pathOffset: tailOffset }}
        />
        <g ref={cometRef}>
          <circle r={11} fill={INK} opacity={0.08} />
          <circle r={3.5} fill={INK} />
        </g>
      </motion.g>
    </g>
  );
}

function ModelNode({
  x,
  y,
  r,
  label,
  logo,
  appear,
  sendAt,
  progress,
  small,
}: {
  x: number;
  y: number;
  r: number;
  label: string;
  logo: string;
  appear: [number, number];
  sendAt: number;
  progress: MotionValue<number>;
  small: boolean;
}) {
  const on = useTransform(progress, appear, [0, 1], { clamp: true });
  const scale = useTransform(on, [0, 1], [0.6, 1]);
  const lift = useTransform(on, [0, 1], [-14, 0]);
  // The border inks in as this model's line leaves for the gateway.
  const stroke = useTransform(progress, [sendAt, sendAt + 0.03], [BORDER, INK]);
  const ring = useTransform(progress, [sendAt, sendAt + 0.08], [0, 1], { clamp: true });
  const ringR = useTransform(ring, [0, 1], [r, r * 1.9]);
  const ringOpacity = useTransform(ring, [0, 0.1, 1], [0, 0.28, 0]);
  const logoSize = r * 1.15;

  return (
    <g>
      <motion.circle cx={x} cy={y} r={ringR} fill="none" stroke={INK} strokeWidth={1} style={{ opacity: ringOpacity }} />
      <motion.g style={{ opacity: on, y: lift }}>
        <motion.g style={{ scale }}>
          <motion.circle cx={x} cy={y} r={r} fill="#fff" strokeWidth={1} style={{ stroke }} />
          <image href={logo} x={x - logoSize / 2} y={y - logoSize / 2} width={logoSize} height={logoSize} />
        </motion.g>
        <text x={x} y={y + r + (small ? 18 : 24)} textAnchor="middle" fill="#404040" fontSize={small ? 12 : 14} fontWeight={600}>
          {label}
        </text>
      </motion.g>
    </g>
  );
}

function Gateway({ geo, progress }: { geo: Geo; progress: MotionValue<number> }) {
  const { cx, gateY, gate } = geo;
  const appear = useTransform(progress, GATE_IN, [0, 1], { clamp: true });
  const tileScale = useTransform(progress, [GATE_IN[0], GATE_IN[1], 0.46, 0.52], [0.82, 1, 1.06, 1]);
  const tileY = useTransform(appear, [0, 1], [18, 0]);
  const pulse = useTransform(progress, GATE_PULSE, [0, 1], { clamp: true });
  const ringScale = useTransform(pulse, [0, 1], [1, 2]);
  const ringOpacity = useTransform(pulse, [0, 0.1, 1], [0, 0.4, 0]);
  const glow = useTransform(progress, [0.36, 0.45, 0.62], [0, 1, 0.6]);
  const orbitOn = useTransform(progress, [0.3, 0.46], [0, 1], { clamp: true });
  const orbitSpin = useTransform(progress, [0.3, 0.6], [0, 140], { clamp: true });
  const outerDraw = useTransform(progress, [0.38, 0.56], [0, 1], { clamp: true });
  const rx = gate * 0.26;

  return (
    <g>
      <motion.circle cx={cx} cy={gateY} r={gate * 1.6} fill="url(#gate-glow)" style={{ opacity: glow }} />
      <motion.circle cx={cx} cy={gateY} r={gate * 1.02} stroke={BORDER} strokeWidth={1} fill="none" style={{ pathLength: outerDraw, rotate: -90 }} />
      <motion.g style={{ rotate: orbitSpin }}>
        <motion.circle
          cx={cx}
          cy={gateY}
          r={gate * 0.8}
          stroke="#a3a3a3"
          strokeWidth={1.25}
          strokeDasharray="2 9"
          strokeLinecap="round"
          fill="none"
          style={{ opacity: orbitOn }}
        />
        <motion.circle cx={cx} cy={gateY - gate * 0.8} r={3} fill={INK} style={{ opacity: orbitOn }} />
      </motion.g>
      <motion.rect
        x={cx - gate / 2}
        y={gateY - gate / 2}
        width={gate}
        height={gate}
        rx={rx}
        fill="none"
        stroke={INK}
        style={{ scale: ringScale, opacity: ringOpacity }}
      />
      <motion.g style={{ opacity: appear, y: tileY }}>
        <motion.g style={{ scale: tileScale }}>
          <clipPath id="gw-clip">
            <rect x={cx - gate / 2} y={gateY - gate / 2} width={gate} height={gate} rx={rx} />
          </clipPath>
          <ellipse cx={cx} cy={gateY + gate / 2 + 6} rx={gate * 0.55} ry={14} fill="url(#shadow)" />
          <rect x={cx - gate / 2} y={gateY - gate / 2} width={gate} height={gate} rx={rx} fill="#000" />
          <image
            href="/morphic-symbol.jpg"
            x={cx - gate}
            y={gateY - gate * 0.8}
            width={gate * 2}
            height={gate * 1.6}
            clipPath="url(#gw-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
        </motion.g>
        <text x={cx} y={gateY + gate / 2 + 34} textAnchor="middle" fill="#525252" fontSize={15} fontWeight={600} letterSpacing="0.04em">
          Morphic Gateway
        </text>
      </motion.g>
    </g>
  );
}

/** A stop on the spine: its dot fills and its label inks in when the comet passes. */
function Checkpoint({
  x,
  y,
  at,
  title,
  detail,
  progress,
}: {
  x: number;
  y: number;
  at: number;
  title: string;
  detail: string;
  progress: MotionValue<number>;
}) {
  const on = useTransform(progress, [at - 0.01, at + 0.02], [0, 1], { clamp: true });
  const fill = useTransform(on, [0, 1], ['#ffffff', INK]);
  const textOpacity = useTransform(on, [0, 1], [0.25, 1]);
  const shift = useTransform(on, [0, 1], [-8, 0]);
  return (
    <g>
      <motion.circle cx={x} cy={y} r={6} stroke={INK} strokeWidth={1.5} style={{ fill }} />
      <motion.g style={{ opacity: textOpacity, x: shift }}>
        <text x={x + 20} y={y - 2} fill={INK} fontSize={16} fontWeight={700}>
          {title}
        </text>
        <text x={x + 20} y={y + 18} fill="#737373" fontSize={13} fontWeight={500}>
          {detail}
        </text>
      </motion.g>
    </g>
  );
}

function EndNode({ geo, progress, title, caption }: { geo: Geo; progress: MotionValue<number>; title: string; caption: string }) {
  const on = useTransform(progress, END_IN, [0, 1], { clamp: true });
  const scale = useTransform(on, [0, 1], [0.85, 1]);
  const captionOn = useTransform(progress, [0.94, 0.99], [0, 1]);
  const { cx, endY } = geo;
  return (
    <g>
      <motion.g style={{ opacity: on, scale }}>
        <ellipse cx={cx} cy={endY + 36} rx={100} ry={12} fill="url(#shadow)" />
        <rect x={cx - 92} y={endY - 34} width={184} height={68} rx={34} fill={INK} />
        <text x={cx} y={endY + 6} textAnchor="middle" fill="#fff" fontSize={18} fontWeight={700}>
          {title}
        </text>
      </motion.g>
      <motion.text x={cx} y={endY + 74} textAnchor="middle" fill="#525252" fontSize={15} fontWeight={500} style={{ opacity: captionOn }}>
        {caption}
      </motion.text>
    </g>
  );
}

function Drawing({ geo, progress, en }: { geo: Geo; progress: MotionValue<number>; en: boolean }) {
  const small = geo.w < 600;
  const checks = en
    ? [
        ['One key', 'checked once for every model'],
        ['One balance', 'credits billed per request'],
        ['One format', 'answers in the OpenAI shape'],
      ]
    : [
        ['Satu key', 'dicek sekali untuk semua model'],
        ['Satu saldo', 'kredit dipotong per request'],
        ['Satu format', 'jawaban dalam format OpenAI'],
      ];

  const viewBox = `0 0 ${geo.w} ${geo.h}`;
  const segs = [...geo.inbound, geo.spine];
  // Three stacked layers so each rasters on its own: the rails never change after the first
  // paint, the nodes change only as they appear, and only the ink layer repaints while scrolling.
  const layer = 'absolute inset-0 h-full w-full overflow-visible will-change-transform';

  return (
    <div className="relative">
      <svg viewBox={viewBox} className="block h-auto w-full overflow-visible will-change-transform" fill="none" aria-hidden="true">
        <text x={geo.cx} y={geo.labelY} textAnchor="middle" fill="#737373" fontSize={13} fontWeight={600} letterSpacing="0.18em">
          THE GATEWAY
        </text>
        {segs.map((s, i) => (
          <path key={i} d={s.d} stroke={RAIL} strokeWidth={1.25} fill="none" />
        ))}
      </svg>

      <svg viewBox={viewBox} className={layer} fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="gate-glow">
            <stop offset="0%" stopColor="#a3a3a3" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="shadow">
            <stop offset="0%" stopColor={INK} stopOpacity="0.12" />
            <stop offset="100%" stopColor={INK} stopOpacity="0" />
          </radialGradient>
        </defs>
        {segs.map((s, i) => (
          <Route key={`ink-${geo.w}-${i}`} seg={s} progress={progress} />
        ))}
        <Gateway geo={geo} progress={progress} />
        {geo.checks.map((c, i) => (
          <Checkpoint key={i} x={geo.cx} y={c.y} at={c.at} title={checks[i][0]} detail={checks[i][1]} progress={progress} />
        ))}
        <EndNode
          geo={geo}
          progress={progress}
          title={en ? 'Your app' : 'Aplikasi kamu'}
          caption={en ? 'One key. Every model.' : 'Satu key. Semua model.'}
        />
      </svg>

      <svg viewBox={viewBox} className={layer} fill="none" aria-hidden="true">
        {geo.nodes.map((n, i) => (
          <ModelNode
            key={`${geo.w}-${MODELS[i].label}`}
            x={n.x}
            y={n.y}
            r={geo.r}
            label={MODELS[i].label}
            logo={MODELS[i].logo}
            appear={n.appear}
            sendAt={geo.inbound[i].range[0]}
            progress={progress}
            small={small}
          />
        ))}
      </svg>
    </div>
  );
}

export default function FeatureShowcase() {
  const { locale } = useTranslation();
  const mobile = useIsMobile();
  const geo = mobile ? mobileGeo() : desktopGeo();
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  // One critically damped spring smooths wheel steps for both the drawing and the camera.
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.35, restDelta: 0.0002 });
  // Pans the drawing so `focus` (a y in drawing units) sits at the viewport middle.
  const cameraY = useTransform(smooth, geo.cameraAt, geo.focus.map((f) => `${(-f / geo.h) * 100}%`));

  const en = locale === 'en';
  const summary = en
    ? 'OpenAI, Gemini, Claude, Grok, Llama, Mistral, DeepSeek, Qwen, Kimi, GLM, MiniMax and Yi all route through the Morphic Gateway, which checks one key, bills one balance and answers your app in the OpenAI format.'
    : 'OpenAI, Gemini, Claude, Grok, Llama, Mistral, DeepSeek, Qwen, Kimi, GLM, MiniMax dan Yi semuanya lewat Morphic Gateway, yang mengecek satu key, memotong satu saldo, dan menjawab aplikasi kamu dalam format OpenAI.';
  const width = mobile ? 'max-w-[400px]' : 'max-w-[900px]';

  return (
    <section id="gateway" className="relative bg-white scroll-mt-20">
      <p className="sr-only">{summary}</p>
      <div ref={trackRef} className="relative h-[520vh]">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <motion.div
            style={{ y: cameraY, x: '-50%' }}
            className={`absolute left-1/2 top-1/2 w-[calc(100%-32px)] will-change-transform ${width}`}
          >
            <Drawing geo={geo} progress={smooth} en={en} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
