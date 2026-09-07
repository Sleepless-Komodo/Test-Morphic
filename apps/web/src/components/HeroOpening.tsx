'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sparkles, KeyRound } from 'lucide-react';
import Hls from 'hls.js';
import { useTranslation } from '@/lib/i18n';

interface HeroOpeningProps {
  isLoggedIn?: boolean;
}

export default function HeroOpening({ isLoggedIn = false }: HeroOpeningProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video) return;

    const src = 'https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8';
    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        maxBufferLength: 8,
        maxMaxBufferLength: 15,
        maxBufferSize: 5 * 1024 * 1024,
        lowLatencyMode: false,
        backBufferLength: 5,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && container) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!video) return;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(container);
    }

    return () => {
      observer?.disconnect();
      if (hls) {
        hls.destroy();
      }
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full px-4 sm:px-6 text-center overflow-hidden flex flex-col items-center justify-center will-change-transform min-h-screen"
      style={{ minHeight: '100svh' }}
    >
      {/* Background HLS Video with full viewport coverage - faded 40% (opacity-60) for soft ambient aesthetic */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-60 contrast-105 pointer-events-none transform-gpu translate-z-0 [filter:invert(1)_hue-rotate(180deg)]"
      />

      {/* Top & Bottom gradient fades for smooth boundary transition */}
      <div className="absolute top-0 left-0 right-0 z-[1] pointer-events-none h-28 bg-gradient-to-b from-[#fafafa] to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 z-[1] pointer-events-none h-24 bg-gradient-to-t from-[#fafafa] to-transparent" />

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto w-full flex flex-col items-center justify-center transform-gpu pt-28 pb-16 sm:pt-32 sm:pb-20">
        {/* Concise Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-neutral-200 text-neutral-800 text-xs font-semibold mb-6 shadow-xs">
          <Sparkles className="h-3.5 w-3.5 text-neutral-900" />
          <span>{t.hero.badge}</span>
        </div>

        {/* Human & Benefit-Oriented Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-extrabold text-neutral-950 tracking-tight leading-[1.1] sm:leading-[1.05] max-w-3xl mx-auto mb-6">
          {t.hero.headline}
          {t.hero.headlineSub && (
            <span className="block text-neutral-500 font-bold sm:inline ml-2">
              {t.hero.headlineSub}
            </span>
          )}
        </h1>

        {/* Readable, larger Subheadline with high contrast */}
        <p className="text-neutral-800 font-body font-normal text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed px-2">
          {t.hero.subheadline}
        </p>

        {/* Action Buttons with fixed min-widths to prevent layout jump on language switch */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto">
          <Link
            href={isLoggedIn ? '/dashboard/keys' : '/login'}
            className="w-full sm:w-auto min-w-[210px] justify-center bg-neutral-950 hover:bg-neutral-800 text-white rounded-full px-8 py-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2 btn-pill-primary cursor-pointer text-center"
          >
            <span>{isLoggedIn ? t.hero.manageKeys : t.hero.primaryCta}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0" />
          </Link>
          <Link
            href="/models"
            className="w-full sm:w-auto min-w-[190px] justify-center bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-900 rounded-full px-8 py-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2 btn-pill-secondary cursor-pointer text-center"
          >
            <span>{t.hero.secondaryCta}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
}
