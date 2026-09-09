'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { ArrowUpRight, Menu, X, LayoutDashboard, LogIn, Globe } from 'lucide-react';

interface NavbarProps {
  session?: any;
}

export default function Navbar({ session }: NavbarProps) {
  const { locale, setLocale, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleLanguage = () => {
    setLocale(locale === 'id' ? 'en' : 'id');
  };

  const navLinks = [
    { href: '/models', label: t.nav.models, isRoute: true },
    { href: '/pricing', label: t.nav.price, isRoute: true },
    { href: '/docs', label: t.nav.docs, isRoute: true },
  ];

  const isLinkActive = (href: string, isRoute: boolean) =>
    isRoute
      ? pathname === href || pathname.startsWith(`${href}/`)
      : pathname === '/';

  return (
    <header className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-4xl transform-gpu translate-z-0">
      <div className="bg-white/92 backdrop-blur-xl text-neutral-900 border border-neutral-200/90 rounded-full px-4 sm:px-6 py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex items-center justify-between transition-all duration-200">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/morphic-symbol.jpg"
            alt="Morphic logo"
            width={28}
            height={28}
            priority
            className="w-7 h-7 rounded-full object-cover ring-1 ring-neutral-200 shadow-xs transition-transform group-hover:scale-105 transform-gpu"
          />
          <span className="font-heading font-extrabold text-base tracking-tight text-neutral-950">
            Morphic
          </span>
        </Link>

        {/* Center: Clean Concise Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-neutral-600">
          {navLinks.map((link) => {
            const isActive = isLinkActive(link.href, link.isRoute);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1 transition-colors after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-full after:origin-left after:bg-neutral-950 after:transition-transform after:duration-200 ${
                  isActive
                    ? 'text-neutral-950 font-bold after:scale-x-100'
                    : 'after:scale-x-0 hover:text-neutral-950 hover:after:scale-x-100'
                }`}
              >
                <span suppressHydrationWarning>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Language Switcher & Action Buttons */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Language Switcher Pill (Fixed width to prevent navbar resize on switch) */}
          <button
            onClick={toggleLanguage}
            className="w-14 justify-center flex items-center gap-1 py-1.5 rounded-full border border-neutral-200 hover:border-neutral-300 text-[11px] font-mono font-semibold text-neutral-600 hover:text-neutral-950 bg-neutral-50 hover:bg-neutral-100 transition-all cursor-pointer select-none"
            title="Switch Language (ID / EN)"
          >
            <Globe className="w-3 h-3 text-neutral-500 shrink-0" />
            <span suppressHydrationWarning className="uppercase">{locale}</span>
          </button>

          {session ? (
            <Link
              href="/dashboard"
              className="bg-neutral-950 hover:bg-neutral-800 text-white rounded-full px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs hover:scale-[1.02]"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span suppressHydrationWarning>{t.nav.dashboard}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="min-w-[78px] justify-center border border-neutral-300 text-neutral-800 hover:text-neutral-950 hover:border-neutral-400 hover:bg-neutral-50 rounded-full px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 text-center"
              >
                <LogIn className="h-3 w-3 shrink-0" />
                <span suppressHydrationWarning>{t.nav.login}</span>
              </Link>
              <Link
                href="/models"
                className="min-w-[96px] justify-center bg-neutral-950 hover:bg-neutral-800 text-white rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1 transition-all shadow-xs hover:scale-[1.02] text-center"
              >
                <span suppressHydrationWarning>{t.nav.getStarted}</span>
                <ArrowUpRight className="h-3 w-3 shrink-0" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle & Language toggle */}
        <div className="sm:hidden flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="px-2 py-1 rounded-full border border-neutral-200 text-[10px] font-mono font-semibold uppercase text-neutral-700 bg-neutral-100"
          >
            {locale}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-neutral-800 hover:text-neutral-950 rounded-lg"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slideout Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden mt-2 bg-white/95 backdrop-blur-md border border-neutral-200/90 rounded-3xl p-4 shadow-2xl text-neutral-800 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ease-out transform-gpu">
          {navLinks.map((link) => {
            const isActive = isLinkActive(link.href, link.isRoute);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-xl font-semibold text-xs ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-950'
                    : 'hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-neutral-100 flex flex-col gap-2">
            {session ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center bg-neutral-950 text-white rounded-full py-2.5 text-xs font-bold"
              >
                {t.nav.dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center border border-neutral-300 text-neutral-800 rounded-full py-2.5 text-xs font-semibold"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/models"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center bg-neutral-950 text-white rounded-full py-2.5 text-xs font-bold"
                >
                  {t.nav.getStarted}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
