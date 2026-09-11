'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';

interface TopologyNode {
  id: string;
  label: string;
  logo: string;
  category: 'model' | 'client';
  provider: string;
  specs: string;
  latency: string;
  /** Angle in degrees; 0 = right, clockwise */
  angle: number;
  /** Radius in viewBox units (container is 100x100) */
  radius: number;
  depth: number;
}

const NODES: TopologyNode[] = [
  // AI providers — cardinal positions (Top, Right, Bottom, Left)
  {
    id: 'claude',
    label: 'Claude 3.5',
    logo: '/logos/claude-color.svg',
    category: 'model',
    provider: 'Anthropic',
    specs: '200K Context · Sonnet & Haiku',
    latency: '152ms',
    angle: -90,
    radius: 36,
    depth: 14,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek V4',
    logo: '/logos/deepseek-color.svg',
    category: 'model',
    provider: 'DeepSeek',
    specs: '64K Context · Reasoning R1 & Coder',
    latency: '138ms',
    angle: 0,
    radius: 36,
    depth: 14,
  },
  {
    id: 'qwen',
    label: 'Qwen 2.5 Max',
    logo: '/logos/qwen-color.svg',
    category: 'model',
    provider: 'Alibaba Cloud',
    specs: '128K Context · Multi-Lingual & Math',
    latency: '144ms',
    angle: 90,
    radius: 36,
    depth: 14,
  },
  {
    id: 'kimi',
    label: 'Kimi K1.5',
    logo: '/logos/kimi-color.svg',
    category: 'model',
    provider: 'Moonshot AI',
    specs: '128K Context · Long-Horizon Coding',
    latency: '146ms',
    angle: 180,
    radius: 36,
    depth: 14,
  },
  // Developer tools — diagonal positions
  {
    id: 'cursor',
    label: 'Cursor',
    logo: '/logos/cursor.svg',
    category: 'client',
    provider: 'AI Editor',
    specs: 'OpenAI Base URL · Tab & Composer',
    latency: 'Local',
    angle: -45,
    radius: 44,
    depth: 6,
  },
  {
    id: 'cline',
    label: 'Cline',
    logo: '/logos/cline.svg',
    category: 'client',
    provider: 'VS Code Agent',
    specs: 'Autonomous Agent · Streaming SSE',
    latency: 'Local',
    angle: 45,
    radius: 44,
    depth: 6,
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    logo: '/logos/windsurf.svg',
    category: 'client',
    provider: 'Codeium IDE',
    specs: 'Cascade Engine · Drop-in Endpoint',
    latency: 'Local',
    angle: 135,
    radius: 44,
    depth: 6,
  },
  {
    id: 'openai',
    label: 'OpenAI SDK',
    logo: '/logos/openai.svg',
    category: 'client',
    provider: 'SDK / CLI',
    specs: 'Python / Node.js Standard Client',
    latency: 'Local',
    angle: -135,
    radius: 44,
    depth: 6,
  },
];


function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

export default function RouterTopology() {
  const { locale } = useTranslation();
  const sceneRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [activeNode, setActiveNode] = useState(1); // Default to DeepSeek
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const selectedIdx = hoveredNode !== null ? hoveredNode : activeNode;
  const currentSelected = NODES[selectedIdx] || NODES[0];

  // Auto-cycle through nodes if not hovered
  useEffect(() => {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const interval = setInterval(() => {
      if (hoveredNode === null) {
        setActiveNode((prev) => (prev + 1) % NODES.length);
      }
    }, 3200);
    return () => clearInterval(interval);
  }, [hoveredNode]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      scene.style.transform = `rotateY(${nx * 8}deg) rotateX(${-ny * 8}deg)`;
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    setHoveredNode(null);
    const scene = sceneRef.current;
    if (!scene) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      scene.style.transform = 'rotateY(0deg) rotateX(0deg)';
    });
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Visual Canvas Container with HUD telemetry */}
      <div
        className="relative w-full max-w-[34rem] aspect-square select-none [perspective:1200px] rounded-3xl border border-neutral-200/90 bg-white shadow-[0_16px_50px_-15px_rgba(0,0,0,0.06)] overflow-hidden p-2 sm:p-4"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        aria-hidden="true"
      >
        {/* Subtle Ambient Radial Grid Background */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:18px_18px] opacity-60" />

        {/* Top Telemetry Header */}
        <div className="absolute top-4 left-5 right-5 z-20 flex items-center justify-between pointer-events-none font-mono text-[10px]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
            <span className="font-bold tracking-widest text-neutral-700 uppercase">
              ROUTER TOPOLOGY
            </span>
          </div>
          <span className="font-semibold text-neutral-400 uppercase tracking-widest hidden sm:inline">
            MESH PROTOCOL · 99.9% UPTIME
          </span>
        </div>

        {/* 3D Scene Track */}
        <div
          ref={sceneRef}
          className="absolute inset-0 [transform-style:preserve-3d] transition-transform duration-300 ease-out"
        >
          {/* Subtle concentric orbit rings in SVG (Zero harsh spoke lines) */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Concentric Orbit Rings — Clean & Airy */}
            <circle cx="50" cy="50" r="16" stroke="rgba(15, 23, 42, 0.06)" strokeWidth="0.75" strokeDasharray="1 3" />
            <circle cx="50" cy="50" r="28" stroke="rgba(15, 23, 42, 0.07)" strokeWidth="0.75" strokeDasharray="1.5 4" />
            <circle cx="50" cy="50" r="38" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="0.75" />
            <circle cx="50" cy="50" r="45" stroke="rgba(15, 23, 42, 0.05)" strokeWidth="0.75" strokeDasharray="2 4" />

            {/* Faint crosshair axes */}
            <line x1="50" y1="8" x2="50" y2="92" stroke="rgba(15, 23, 42, 0.04)" strokeWidth="0.75" />
            <line x1="8" y1="50" x2="92" y2="50" stroke="rgba(15, 23, 42, 0.04)" strokeWidth="0.75" />

            {/* Dynamic Living Conduit Lines connecting each node to MORPHIC Hub */}
            {NODES.map((node, i) => {
              const p = polar(node.angle, node.radius);
              const isSelected = i === selectedIdx;
              const isClient = node.category === 'client';

              return (
                <g key={`conduit-${node.id}`}>
                  {/* Subtle static conduit ray */}
                  <line
                    x1="50"
                    y1="50"
                    x2={p.x}
                    y2={p.y}
                    stroke={isSelected ? 'rgba(16, 185, 129, 0.45)' : 'rgba(15, 23, 42, 0.06)'}
                    strokeWidth={isSelected ? 1.2 : 0.6}
                    strokeDasharray={isSelected ? 'none' : '1 2.5'}
                  />

                  {/* Flowing Data Pulses (flowing inward for clients, outward for models) */}
                  <line
                    x1={isClient ? p.x : 50}
                    y1={isClient ? p.y : 50}
                    x2={isClient ? 50 : p.x}
                    y2={isClient ? 50 : p.y}
                    stroke={isSelected ? '#10b981' : 'rgba(15, 23, 42, 0.28)'}
                    strokeWidth={isSelected ? 1.4 : 0.9}
                    strokeDasharray="2 16"
                    className="topology-packet"
                    style={{
                      animationDuration: isSelected ? '1.1s' : '2.8s',
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Center Hub — MORPHIC Router (Clean & Calm) */}
          <div
            className="absolute left-1/2 top-1/2 z-10"
            style={{ transform: 'translate(-50%, -50%) translateZ(36px)' }}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute h-16 w-16 rounded-full bg-white border border-neutral-200/90 shadow-sm" />
              
              <div className="relative inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 shadow-md ring-1 ring-neutral-800">
                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                <span className="font-mono text-xs font-extrabold tracking-[0.22em] text-white">
                  MORPHIC
                </span>
              </div>
            </div>
          </div>

          {/* Surrounding Nodes (Interactive on Hover) */}
          {NODES.map((node, i) => {
            const p = polar(node.angle, node.radius);
            const isSelected = i === selectedIdx;
            return (
              <button
                key={node.id}
                onMouseEnter={() => setHoveredNode(i)}
                onClick={() => setActiveNode(i)}
                className={`absolute flex items-center gap-2 rounded-xl border px-3 py-1.5 shadow-xs transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? 'border-neutral-950 bg-white shadow-lg scale-110 z-20 ring-2 ring-neutral-950/10'
                    : 'border-neutral-200/90 bg-white hover:border-neutral-400 z-10'
                }`}
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: `translate(-50%, -50%) translateZ(${node.depth}px)${isSelected ? ' scale(1.1)' : ''}`,
                }}
              >
                <Image
                  src={node.logo}
                  alt={node.label}
                  width={20}
                  height={20}
                  unoptimized
                  className="h-4 sm:h-5 w-4 sm:w-5 shrink-0"
                />
                <span
                  className={`text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors duration-300 ${
                    isSelected ? 'text-neutral-950 font-bold' : 'text-neutral-700'
                  }`}
                >
                  {node.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Inspector Detail Strip directly under the canvas */}
      <div className="mt-5 w-full max-w-[34rem] rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-2xs flex items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
            <Image
              src={currentSelected.logo}
              alt={currentSelected.label}
              width={20}
              height={20}
              unoptimized
              className="h-5 w-5 object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-xs sm:text-sm text-neutral-950">
                {currentSelected.label}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-[10px] font-mono font-bold text-neutral-600">
                {currentSelected.provider}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 font-body mt-0.5">
              {currentSelected.specs}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 font-mono">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            {currentSelected.category === 'model' ? (locale === 'en' ? 'LATENCY' : 'LATENSI') : 'STATUS'}
          </div>
          <div className="text-xs font-extrabold text-emerald-600">
            {currentSelected.category === 'model' ? currentSelected.latency : 'Connected'}
          </div>
        </div>
      </div>
    </div>
  );
}
