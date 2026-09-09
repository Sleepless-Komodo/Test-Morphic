'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SignOutButton } from '@/app/dashboard/sign-out';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CreditCard,
  Cpu,
  Globe,
  KeyRound,
  LayoutDashboard,
  Menu,
  Ticket,
  X,
  Zap,
} from 'lucide-react';

interface DashboardShellProps {
  session: {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  };
  balance: number;
  children: React.ReactNode;
}

export function DashboardShell({ session, balance, children }: DashboardShellProps) {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    { href: '/dashboard', label: t.dashboard.navOverview, icon: LayoutDashboard },
    { href: '/dashboard/keys', label: t.dashboard.navKeys, icon: KeyRound },
    { href: '/dashboard/models', label: t.dashboard.navModels, icon: Cpu },
    { href: '/dashboard/billing', label: t.dashboard.navBilling, icon: CreditCard },
    { href: '/dashboard/redeem', label: t.dashboard.navVoucher, icon: Ticket },
    { href: '/dashboard/usage', label: t.dashboard.navUsage, icon: BarChart3 },
  ];

  const isActive = (href: string) => pathname === href;

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const navLinks = navItems.map((item) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileNavOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
          active
            ? 'bg-neutral-950 text-white shadow-xs'
            : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-neutral-500'}`} />
        <span suppressHydrationWarning>{item.label}</span>
      </Link>
    );
  });

  const sidebarContent = (
    <>
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 group px-4 pt-2 pb-6">
        <Image
          src="/morphic-symbol.jpg"
          alt="Morphic logo"
          width={40}
          height={40}
          priority
          className="w-10 h-10 rounded-full object-cover ring-1 ring-neutral-200 shadow-xs transition-transform group-hover:scale-105 transform-gpu"
        />
        <div className="min-w-0">
          <span className="block font-heading font-extrabold text-lg tracking-tight text-neutral-950 truncate">
            Morphic
          </span>
        </div>
      </Link>

      {/* Credits Balance */}
      <Link
        href="/dashboard/billing"
        onClick={() => setMobileNavOpen(false)}
        className="mx-4 mb-6 flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/90 hover:border-neutral-300 transition-all"
      >
        <Zap className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <span
            suppressHydrationWarning
            className="block text-[11px] font-semibold text-neutral-500 leading-tight mb-0.5"
          >
            {t.dashboard.balanceLabel}
          </span>
          <span className="block text-sm font-mono font-bold text-neutral-950 truncate">
            Rp {balance.toLocaleString('id-ID')}
          </span>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="px-4 flex flex-col gap-2">{navLinks}</nav>

      {/* Utility links & Language selector (Above Account) */}
      <div className="mt-auto mx-4 pt-4 border-t border-neutral-200/80 flex flex-col gap-1">
        <Link
          href="/docs"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors"
        >
          <BookOpen className="h-4 w-4 shrink-0 text-neutral-500" />
          <span suppressHydrationWarning>{t.nav.docs}</span>
        </Link>
        <Link
          href="/"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors"
        >
          <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-500" />
          <span suppressHydrationWarning>
            {locale === 'id' ? 'Kembali ke Situs' : 'Back to Site'}
          </span>
        </Link>

        {/* Language Selection Row */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs font-semibold text-neutral-600">
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 shrink-0 text-neutral-500" />
            <span suppressHydrationWarning>{locale === 'id' ? 'Bahasa' : 'Language'}</span>
          </div>
          <LanguageToggle />
        </div>
      </div>

      {/* Account Profile Card (Bottom Anchor) */}
      <div className="mx-4 mt-3 pt-3 border-t border-neutral-200/80">
        <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between gap-3 hover:border-neutral-300 transition-colors">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name || 'Avatar'}
                width={36}
                height={36}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-xl object-cover ring-1 ring-neutral-200 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-neutral-200 border border-neutral-300 flex items-center justify-center text-xs font-bold text-neutral-700 shrink-0">
                {(session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'U').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div
                suppressHydrationWarning
                className="text-xs font-bold text-neutral-950 leading-snug truncate"
              >
                {session?.user?.name || (locale === 'en' ? 'Developer' : 'Pengembang')}
              </div>
              <div className="text-[11px] text-neutral-500 font-mono truncate leading-snug">
                {session?.user?.email}
              </div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 font-body selection:bg-neutral-900 selection:text-white flex items-start">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col sticky top-0 h-screen overflow-y-auto bg-white border-r border-neutral-200/90 py-5">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 w-full px-4 sm:px-6 md:px-8 py-6">{children}</main>

      {/* Mobile: Floating Menu Button */}
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="lg:hidden fixed bottom-5 left-5 z-40 p-3 rounded-full bg-neutral-950 text-white shadow-2xl cursor-pointer hover:bg-neutral-800 transition-colors"
        aria-label="Open Navigation Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute top-0 left-0 h-full w-72 bg-white border-r border-neutral-200 shadow-2xl py-4 flex flex-col animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-neutral-800 hover:text-neutral-950 rounded-lg cursor-pointer"
              aria-label="Close Navigation Menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </div>
  );
}
