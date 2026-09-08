'use client';

import React, { useState, useRef } from 'react';

export default function MorphicHoverEffect() {
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full py-16 sm:py-24 overflow-hidden select-none bg-neutral-950 text-white rounded-3xl my-8 border border-neutral-800/80 cursor-default group"
    >
      {/* Dynamic Cursor Spotlight Radial Glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500 will-change-transform"
        style={{
          opacity: isHovered ? 0.7 : 0.25,
          background: `radial-gradient(600px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.12), transparent 40%)`,
        }}
      />

      {/* Subtle Mesh Grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Content & Morphic Typographic Signature */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono tracking-widest text-neutral-400 uppercase mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Morphic Engine • 2026</span>
        </div>

        {/* Big atmospheric typography that reveals/lights up when cursor hovers */}
        <h2
          className="text-6xl sm:text-8xl md:text-9xl font-heading font-extrabold tracking-tighter uppercase transition-all duration-300 transform-gpu leading-none"
          style={{
            color: isHovered ? '#ffffff' : '#3f3f46',
            textShadow: isHovered
              ? '0 0 40px rgba(255,255,255,0.25), 0 0 80px rgba(255,255,255,0.1)'
              : 'none',
            letterSpacing: isHovered ? '-0.04em' : '-0.02em',
          }}
        >
          Morphic
        </h2>

        <p className="mt-4 text-xs sm:text-sm text-neutral-400 max-w-md mx-auto font-body">
          Next-generation high concurrency AI model routing for Cursor, Cline, and Windsurf.
        </p>
      </div>
    </div>
  );
}
