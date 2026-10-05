'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

interface AuthCardProps {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

/** Page shell for the single-purpose auth steps (OTP code, forgot and reset password). */
export function AuthCard({ backHref, backLabel, title, description, children }: AuthCardProps) {
  return (
    <main className="min-h-screen flex flex-col justify-between bg-[#fafafa] text-neutral-900 px-4 sm:px-6 py-8 sm:py-10">
      <div className="max-w-md w-full mx-auto">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 min-h-11 text-xs font-semibold text-neutral-600 hover:text-neutral-950 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span suppressHydrationWarning>{backLabel}</span>
        </Link>
      </div>

      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white border border-neutral-300/80 rounded-3xl p-7 sm:p-9 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.08)] ring-1 ring-neutral-900/5 text-center">
          <div className="flex justify-center mb-5">
            <Link href="/" className="inline-block">
              <Image
                src="/morphic-symbol.jpg"
                alt="Morphic logo"
                width={44}
                height={44}
                priority
                className="w-11 h-11 rounded-2xl object-cover ring-1 ring-neutral-200"
              />
            </Link>
          </div>
          <h1 suppressHydrationWarning className="text-2xl font-heading font-extrabold text-neutral-950 tracking-tight mb-2">
            {title}
          </h1>
          <p suppressHydrationWarning className="text-neutral-600 text-xs sm:text-sm mb-6 leading-relaxed">
            {description}
          </p>
          {children}
        </div>
      </div>

      <div className="text-center text-neutral-500 text-xs">&copy; 2026 Morphic. All rights reserved.</div>
    </main>
  );
}
