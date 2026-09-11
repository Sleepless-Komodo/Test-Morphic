'use client';

import React, { useRef, useState, useCallback } from 'react';
import { useReducedMotionSafe } from '@/lib/use-reduced-motion-safe';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(16, 185, 129, 0.08)',
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const reduced = useReducedMotionSafe();

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduced || !divRef.current) return;
      const rect = divRef.current.getBoundingClientRect();
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [reduced]
  );

  const handleMouseEnter = useCallback(() => {
    if (reduced) return;
    setOpacity(1);
  }, [reduced]);

  const handleMouseLeave = useCallback(() => {
    setOpacity(0);
  }, []);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {/* Dynamic Cursor Spotlight Radial Layer */}
      {!reduced && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
          style={{
            opacity,
            background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 75%)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Card Content */}
      <div className="relative z-10 w-full h-full flex flex-col">{children}</div>
    </div>
  );
}
