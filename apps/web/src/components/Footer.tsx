'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { Globe, ShieldCheck } from 'lucide-react';

export default function Footer() {
  const { locale, setLocale, t } = useTranslation();
  const [mousePos, setMousePos] = useState<{ x: number; y: number; px: number; py: number }>({
    x: 50,
    y: 50,
    px: 600,
    py: 200,
  });
  const [isHovered, setIsHovered] = useState(false);
  const footerRef = useRef<HTMLElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!footerRef.current) return;
    const rect = footerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x = (px / rect.width) * 100;
    const y = (py / rect.height) * 100;

    let textPx = px;
    let textPy = py;
    if (textContainerRef.current) {
      const textRect = textContainerRef.current.getBoundingClientRect();
      textPx = e.clientX - textRect.left;
      textPy = e.clientY - textRect.top;
    }

    setMousePos({ x, y, px: textPx, py: textPy });
  };

  return (
    <footer
      ref={footerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative z-10 pt-16 pb-0 px-3 sm:px-6 md:px-8 bg-black text-neutral-300 border-t border-neutral-900 overflow-hidden select-none transition-colors duration-300"
    >
      {/* Interactive Cursor Spotlight Glow across the entire dark background */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 will-change-transform"
        style={{
          opacity: isHovered ? 0.60 : 0.16,
          background: `radial-gradient(750px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.25), transparent 60%)`,
        }}
      />

      <div className="w-full max-w-[98vw] mx-auto relative z-10 flex flex-col items-center justify-end">
        {/* MASSIVE 3D WIREFRAME "Morphic" TEXT - Clean outline geometry, no collision */}
        <div
          ref={textContainerRef}
          className="w-full relative overflow-hidden select-none flex items-end justify-center"
        >
          {/* Layer 1: Dark 3D Wireframe Base Layer (Always visible, deep dark 3D bevel) */}
          <svg
            viewBox="0 0 1000 110"
            className="w-full h-auto max-w-full block select-none pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Resting Dark Wireframe Gradient - enhanced clarity */}
              <linearGradient id="baseDarkWireframe" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.32)" />
                <stop offset="50%" stopColor="rgba(255, 255, 255, 0.16)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
              </linearGradient>
            </defs>

            {/* 3D Extrusion Depth Underlayer (Gives tangible 3D thickness) */}
            <text
              x="50%"
              y="177"
              textAnchor="middle"
              fill="none"
              stroke="rgba(0, 0, 0, 0.95)"
              strokeWidth="4"
              className="font-heading font-black"
              fontSize="225"
              style={{ letterSpacing: '-0.02em' }}
            >
              Morphic
            </text>

            {/* Resting Base Wireframe Stroke */}
            <text
              x="50%"
              y="175"
              textAnchor="middle"
              fill="none"
              stroke="url(#baseDarkWireframe)"
              strokeWidth="1.4"
              strokeLinejoin="round"
              className="font-heading font-black"
              fontSize="225"
              style={{ letterSpacing: '-0.02em' }}
            >
              Morphic
            </text>
          </svg>

          {/* Layer 2: Glowing 3D Cursor Spotlight Mask (Lights up dynamically with high clarity!) */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-200 flex items-end justify-center"
            style={{
              opacity: isHovered ? 1 : 0,
              maskImage: `radial-gradient(420px circle at ${mousePos.px}px ${mousePos.py}px, black 0%, black 35%, transparent 80%)`,
              WebkitMaskImage: `radial-gradient(420px circle at ${mousePos.px}px ${mousePos.py}px, black 0%, black 35%, transparent 80%)`,
            }}
          >
            <svg
              viewBox="0 0 1000 110"
              className="w-full h-auto max-w-full block select-none pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Brilliant 3D Cursor Specular Highlight */}
                <linearGradient id="cursorGlowStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#e4e4e7" />
                  <stop offset="100%" stopColor="#a1a1aa" />
                </linearGradient>

                <filter id="laserBloom" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="glow" />
                  <feComposite in="SourceGraphic" in2="glow" operator="over" />
                </filter>
              </defs>

              {/* Glowing 3D Bevel Highlight directly under the cursor */}
              <text
                x="50%"
                y="175"
                textAnchor="middle"
                fill="none"
                stroke="url(#cursorGlowStroke)"
                strokeWidth="2.4"
                strokeLinejoin="round"
                filter="url(#laserBloom)"
                className="font-heading font-black drop-shadow-[0_0_24px_rgba(255,255,255,0.7)]"
                fontSize="225"
                style={{ letterSpacing: '-0.02em' }}
              >
                Morphic
              </text>
            </svg>
          </div>
        </div>

        {/* Clear-Background Floating Horizon Bar (Matching user image: 100% transparent, no border divider, overlays seamlessly at bottom) */}
        <div className="relative sm:absolute inset-x-0 bottom-4 w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-body text-neutral-500 px-4 sm:px-6 md:px-8 pointer-events-none z-20 pb-4 sm:pb-0">
          {/* Left: Copyright & Brand Tagline (Matching user reference image) */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-center sm:text-left pointer-events-auto bg-transparent">
            <Link
              href="/"
              className="font-heading font-extrabold text-sm tracking-tight text-white hover:text-neutral-200 transition-colors"
            >
              Morphic
            </Link>
            <span className="text-neutral-600 hidden sm:inline">|</span>
            <p className="text-neutral-400 font-body text-xs font-normal">
              {locale === 'id'
                ? '© 2026 Morphic. Reseller API Key AI Terpercaya untuk Developer Indonesia.'
                : '© 2026 Morphic. Trusted AI API Key Gateway for Developers.'}
            </p>
          </div>

          {/* Right: Navigation Links (Matching user reference image) */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-5 text-neutral-400 text-xs font-body pointer-events-auto bg-transparent">
            <a href="#models" className="hover:text-white transition-colors">
              {locale === 'id' ? 'Katalog Model' : 'Model Catalog'}
            </a>
            <a href="#integration" className="hover:text-white transition-colors">
              {locale === 'id' ? 'Integrasi IDE' : 'IDE Integration'}
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              {locale === 'id' ? 'Keunggulan' : 'Features'}
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
