'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface HeroOpeningProps {
  isLoggedIn?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  r: number;
  pulsePhase: number;
}

export default function HeroOpening({ isLoggedIn = false }: HeroOpeningProps) {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = false;
    let particles: Particle[] = [];
    const mouse = { x: -9999, y: -9999 };
    const LINK_DIST = 145;
    const LINK_DIST2 = LINK_DIST * LINK_DIST;
    const MOUSE_R = 200;
    const MOUSE_R2 = MOUSE_R * MOUSE_R;
    const CURSOR_LINK = 210;
    const CURSOR_LINK2 = CURSOR_LINK * CURSOR_LINK;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = section.clientWidth;
      height = section.clientHeight;
      if (width <= 0 || height <= 0) return;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Higher density: ~150 particles on desktop for a rich, vivid constellation
      const count = Math.min(155, Math.max(65, Math.floor((width * height) / 9500)));
      particles = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        // Natural visible drift speed (0.45 - 0.90 px/frame)
        const baseSpeed = Math.random() * 0.45 + 0.45;
        const vx = Math.cos(angle) * baseSpeed;
        const vy = Math.sin(angle) * baseSpeed;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx,
          vy,
          baseVx: vx,
          baseVy: vy,
          r: Math.random() * 1.8 + 1.8, // 1.8px to 3.6px - crisp and prominent
          pulsePhase: Math.random() * Math.PI * 2,
        };
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Constellation links between particles (crisper contrast)
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST2) {
            const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.28;
            ctx.strokeStyle = `rgba(15, 23, 42, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // 2. Cursor connection lines and interactive cursor focal indicator
      if (mouse.x > -999 && mouse.y > -999) {
        for (const p of particles) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < CURSOR_LINK2) {
            const dist = Math.sqrt(d2);
            const alpha = (1 - dist / CURSOR_LINK) * 0.58;
            ctx.strokeStyle = `rgba(15, 23, 42, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }

        // Center focal dot on cursor
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fill();

        // Outer magnetic pulse ring
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 3. Render particle dots (crisp & clearly visible)
      for (const p of particles) {
        const pulse = Math.sin(p.pulsePhase) * 0.2 + 0.95;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const p of particles) {
        // Elastic return towards base natural drift
        p.vx += (p.baseVx - p.vx) * 0.035;
        p.vy += (p.baseVy - p.vy) * 0.035;

        // Smooth cursor repulsion
        if (mouse.x > -999 && mouse.y > -999) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MOUSE_R2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = Math.pow(1 - d / MOUSE_R, 1.4) * 3.2;
            p.vx += (dx / d) * f * 0.2;
            p.vy += (dy / d) * f * 0.2;
          }
        }

        // Speed governor to prevent wild scattering
        const speed = Math.hypot(p.vx, p.vy);
        const maxSpeed = 3.2;
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Seamless screen wrap
        if (p.x < -20) p.x = width + 20;
        else if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        else if (p.y > height + 20) p.y = -20;

        p.pulsePhase += 0.025;
      }

      draw();
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(step);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    start();

    const onResize = () => {
      resize();
      draw();
    };

    // Track pointer across the viewport and translate to canvas coordinates
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        if (!running) start();
      } else {
        mouse.x = -9999;
        mouse.y = -9999;
      }
    };

    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            start();
          } else {
            stop();
          }
        },
        { threshold: 0 },
      );
      observer.observe(section);
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', onLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="hero-section relative w-full px-4 sm:px-6 text-center overflow-hidden flex flex-col items-center justify-center min-h-screen"
      style={{ minHeight: '100svh' }}
    >
      {/* Animated background: soft light gradient + drifting aurora + interactive particle network canvas */}
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-aurora hero-aurora-1" />
        <div className="hero-aurora hero-aurora-2" />
        <canvas ref={canvasRef} className="hero-bg-canvas" />
      </div>

      {/* Soft fade into the next section */}
      <div className="absolute bottom-0 left-0 right-0 z-[1] pointer-events-none h-24 bg-gradient-to-t from-[#fafafa] to-transparent" />

      {/* Hero Content */}
      <div className="hero-font relative z-10 max-w-4xl mx-auto w-full flex flex-col items-center justify-center pt-28 pb-16 sm:pt-32 sm:pb-20">
        {/* Glass panel blurs the animated background behind badge + headline for readability */}
        <div className="hero-headline-glass relative flex flex-col items-center w-full mb-6">
          <div className="hero-headline-glass-blur" aria-hidden="true" />

          <div className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-white/80 text-neutral-800 text-xs font-semibold mb-6 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-neutral-900" />
            <span>{t.hero.badge}</span>
          </div>

          <h1 className="relative text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-neutral-950 tracking-tight leading-[1.1] sm:leading-[1.05] max-w-3xl mx-auto">
            {t.hero.headline}
            {t.hero.headlineSub && (
              <span className="block text-neutral-500 font-bold sm:inline ml-2">
                {t.hero.headlineSub}
              </span>
            )}
          </h1>
        </div>

        <p className="text-neutral-700 font-normal text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed px-2">
          {t.hero.subheadline}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto">
          <Link
            href={isLoggedIn ? '/dashboard/keys' : '/login'}
            className="w-full sm:w-auto min-w-[210px] justify-center rounded-full px-8 py-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2 btn-hero-primary cursor-pointer text-center"
          >
            <span>{isLoggedIn ? t.hero.manageKeys : t.hero.primaryCta}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 btn-hero-icon" />
          </Link>
          <Link
            href="/models"
            className="w-full sm:w-auto min-w-[190px] justify-center rounded-full px-8 py-3.5 text-xs sm:text-sm font-semibold flex items-center gap-2 btn-hero-secondary cursor-pointer text-center"
          >
            <span>{t.hero.secondaryCta}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 btn-hero-icon" />
          </Link>
        </div>
      </div>
    </section>
  );
}
