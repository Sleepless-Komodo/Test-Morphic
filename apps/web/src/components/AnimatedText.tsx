'use client';

import React from 'react';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';

interface AnimatedTextProps {
  text: string;
  className?: string;
}

/**
 * AnimatedText Component
 * Produces a slick vertical roll-up ticker micro-interaction on parent hover (.group).
 * Fully accessible with screen-reader text fallback and reduced-motion detection.
 */
export default function AnimatedText({ text, className = '' }: AnimatedTextProps) {
  const reduced = useReducedMotionSafe();

  if (reduced) {
    return <span className={className}>{text}</span>;
  }

  return (
    <>
      <span
        className={`relative overflow-hidden inline-flex leading-tight ${className}`}
        aria-hidden="true"
      >
        {/* Top Resting Label (slides up on hover) */}
        <span className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-[125%] whitespace-nowrap block">
          {text}
        </span>

        {/* Bottom Duplicate Label (slides in from below on hover) */}
        <span className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] translate-y-[125%] group-hover:translate-y-0 whitespace-nowrap flex items-center justify-center">
          {text}
        </span>
      </span>
      {/* Hidden duplicate for screen readers so text is read exactly once */}
      <span className="sr-only">{text}</span>
    </>
  );
}
