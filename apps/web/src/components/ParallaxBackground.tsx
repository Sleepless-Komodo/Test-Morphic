'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

interface ParallaxBackgroundProps {
  sectionRef: React.RefObject<HTMLElement | null>;
}

/**

 * Fine-art sculptural glass/ceramic ribbon image with smooth scroll parallax (0.22x depth),
 * layered with subtle perspective grid, ethereal lighting, and seamless blend into #fafafa.
 */
export default function ParallaxBackground({ sectionRef }: ParallaxBackgroundProps) {
  const bgLayerRef = useRef<HTMLDivElement>(null);
  const orbsLayerRef = useRef<HTMLDivElement>(null);
  const geoLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      return;
    }

    const section = sectionRef.current;
    if (!section) return;

    // Mouse coordinates (-1 to 1 from center)
    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let mouseCurrentX = 0;
    let mouseCurrentY = 0;

    // Scroll coordinates
    let scrollTarget = 0;
    let scrollCurrent = 0;

    let rafId = 0;
    let isRunning = true;

    let isVisible = true;

    // IntersectionObserver to pause loop when Hero is scrolled out of viewport
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            isVisible = entry.isIntersecting;
          }
        },
        { threshold: 0 }
      );
      observer.observe(section);
    }

    const onVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const handleMouseMove = (e: MouseEvent) => {
      if (!isVisible) return;
      const { innerWidth, innerHeight } = window;
      // Normalized between -1 and 1
      mouseTargetX = (e.clientX / innerWidth - 0.5) * 2;
      mouseTargetY = (e.clientY / innerHeight - 0.5) * 2;
    };

    const handleScroll = () => {
      const rect = section.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > window.innerHeight + 100) {
        isVisible = false;
        return;
      }
      isVisible = true;
      scrollTarget = Math.max(0, -rect.top);
    };

    const loop = () => {
      if (!isRunning) return;

      if (isVisible) {
        // Smooth damping (lerp)
        mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.07;
        mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.07;
        scrollCurrent += (scrollTarget - scrollCurrent) * 0.1;

        // Layer 1: Background artwork & grid (subtle shift)
        if (bgLayerRef.current) {
          const x = mouseCurrentX * -10;
          const y = mouseCurrentY * -8 + scrollCurrent * 0.16;
          bgLayerRef.current.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        }

        // Layer 2: Ethereal glass orbs (strong counter-parallax for deep 3D sense)
        if (orbsLayerRef.current) {
          const x = mouseCurrentX * 28;
          const y = mouseCurrentY * 22 + scrollCurrent * 0.32;
          orbsLayerRef.current.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        }

        // Layer 3: Geometry & concentric rings (medium depth + tilt)
        if (geoLayerRef.current) {
          const x = mouseCurrentX * -16;
          const y = mouseCurrentY * -12 + scrollCurrent * 0.22;
          const rot = mouseCurrentX * 2.0;
          geoLayerRef.current.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    // Initial check
    handleScroll();
    rafId = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [sectionRef]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* Layer 1: Atmospheric Artwork & Depth Perspective Grid */}
      <div
        ref={bgLayerRef}
        className="absolute inset-x-0 -top-[12%] h-[135%] will-change-transform"
        style={{
          WebkitMaskImage:
            'radial-gradient(130% 95% at 50% 25%, rgba(0,0,0,1) 45%, transparent 100%)',
          maskImage:
            'radial-gradient(130% 95% at 50% 25%, rgba(0,0,0,1) 45%, transparent 100%)',
        }}
      >
        {/* Continuous atmospheric artwork image */}
        <div className="absolute inset-0">
          <Image
            src="/images/bg-continuous.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-30 contrast-[1.05] grayscale-[0.25]"
          />
          <div className="absolute inset-0 bg-[#fafafa]/55 mix-blend-screen" />
        </div>

        {/* Base ambient light gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(85% 55% at 50% -5%, rgba(238,241,246,0.7) 0%, transparent 60%), radial-gradient(60% 40% at 80% 10%, rgba(9,9,11,0.03) 0%, transparent 70%)',
          }}
        />

        {/* Depth horizon — perspective grid receding toward center */}
        <div className="absolute left-1/2 top-[38%] w-[160%] -translate-x-1/2 [transform:perspective(700px)_rotateX(58deg)] [transform-origin:50%_0%] opacity-40">
          <div
            className="w-full h-[42rem]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(9,9,11,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(9,9,11,0.07) 1px, transparent 1px)',
              backgroundSize: '5rem 5rem',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.9) 30%, transparent 85%)',
              maskImage:
                'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.9) 30%, transparent 85%)',
            }}
          />
        </div>
      </div>

      {/* Layer 2: Ethereal Glass Orbs with deep counter-parallax & silky ambient lighting */}
      <div ref={orbsLayerRef} className="absolute inset-0 will-change-transform">
        {/* Orb Left */}
        <div
          className="absolute left-[7%] top-[12%] w-60 h-60 rounded-full blur-2xl opacity-80"
          style={{
            background:
              'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0%, rgba(9,9,11,0.04) 45%, transparent 70%)',
            boxShadow: 'inset 0 0 60px rgba(255,255,255,0.6)',
          }}
        />
        {/* Orb Right */}
        <div
          className="absolute right-[8%] top-[7%] w-80 h-80 rounded-full blur-2xl opacity-75"
          style={{
            background:
              'radial-gradient(circle at 65% 35%, rgba(255,255,255,0.9) 0%, rgba(9,9,11,0.035) 45%, transparent 70%)',
            boxShadow: 'inset 0 0 70px rgba(255,255,255,0.55)',
          }}
        />
        {/* Orb Center */}
        <div
          className="absolute left-[47%] top-[24%] w-44 h-44 rounded-full blur-xl opacity-70"
          style={{
            background:
              'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.98) 0%, rgba(9,9,11,0.03) 40%, transparent 65%)',
          }}
        />
      </div>

      {/* Layer 3: Concentric Rings & Fine Geometric Accents */}
      <div ref={geoLayerRef} className="absolute inset-0 will-change-transform">
        <svg
          className="absolute left-1/2 top-[22%] w-[46rem] h-[46rem] -translate-x-1/2 opacity-35"
          viewBox="0 0 736 736"
          fill="none"
        >
          <circle cx="368" cy="368" r="180" stroke="rgba(9,9,11,0.10)" strokeWidth="1" />
          <circle cx="368" cy="368" r="270" stroke="rgba(9,9,11,0.07)" strokeWidth="1" />
          <circle cx="368" cy="368" r="360" stroke="rgba(9,9,11,0.045)" strokeWidth="1" strokeDasharray="4 8" />
        </svg>

        <svg
          className="absolute left-[13%] top-[50%] w-24 h-24 opacity-25 rotate-12"
          viewBox="0 0 96 96"
          fill="none"
        >
          <path
            d="M48 4L88 27v42L48 92 8 69V27L48 4z"
            stroke="rgba(9,9,11,0.18)"
            strokeWidth="1.25"
          />
        </svg>
        <svg
          className="absolute right-[15%] top-[56%] w-16 h-16 opacity-20 -rotate-6"
          viewBox="0 0 64 64"
          fill="none"
        >
          <rect x="8" y="8" width="48" height="48" rx="10" stroke="rgba(9,9,11,0.18)" strokeWidth="1.25" />
          <rect x="20" y="20" width="24" height="24" rx="6" stroke="rgba(9,9,11,0.12)" strokeWidth="1" />
        </svg>
      </div>

      {/* Bottom fade — seamless blend into page background */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#fafafa] via-[#fafafa]/60 to-transparent" />
    </div>
  );
}
