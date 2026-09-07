'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SignOutButton } from '@/app/dashboard/sign-out';
import {
  Cpu,
  KeyRound,
  CreditCard,
  Ticket,
  BarChart3,
  LayoutDashboard,
  Zap,
} from 'lucide-react';

interface DashboardHeaderProps {
  session: {
    user?: {
      name?: string | null;
      email?: string | null;
    };
  };
  balance: number;
}

export function DashboardHeader({ session, balance }: DashboardHeaderProps) {
  const { t, locale } = useTranslation();
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: t.dashboard.navOverview, icon: LayoutDashboard },
    { href: '/dashboard/keys', label: t.dashboard.navKeys, icon: KeyRound },
    { href: '/dashboard/models', label: t.dashboard.navModels, icon: Cpu },
    { href: '/dashboard/billing', label: t.dashboard.navBilling, icon: CreditCard },
    { href: '/dashboard/redeem', label: t.dashboard.navVoucher, icon: Ticket },
    { href: '/dashboard/usage', label: t.dashboard.navUsage, icon: BarChart3 },
  ];

  return (
    <>
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/90 px-4 md:px-8 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              M
            </div>
            <span className="font-heading font-extrabold text-base tracking-tight text-neutral-950">
              Morphic
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200">
              CONSOLE
            </span>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden lg:flex items-center gap-1 text-xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                  <span suppressHydrationWarning>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Language, Credits Balance & User */}
        <div className="flex items-center gap-3">
          <LanguageToggle />

          <Link
            href="/dashboard/billing"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200/90 hover:border-neutral-300 transition-all text-xs font-mono"
          >
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
            <span suppressHydrationWarning className="text-neutral-500 text-[10px] uppercase font-sans font-bold">
              {t.dashboard.balanceLabel}
            </span>
            <span className="font-bold text-neutral-950">Rp {balance.toLocaleString('id-ID')}</span>
          </Link>

          <div className="flex items-center gap-2 pl-2 border-l border-neutral-200">
            <div className="hidden sm:block text-right">
              <div suppressHydrationWarning className="text-xs font-bold text-neutral-950 leading-tight">
                {session?.user?.name || (locale === 'en' ? 'Developer' : 'Pengembang')}
              </div>
              <div className="text-[10px] text-neutral-400 truncate max-w-[120px]">
                {session?.user?.email}
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Sub-header for Mobile Navigation */}
      <div className="lg:hidden bg-white border-b border-neutral-200/80 px-4 py-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-semibold text-xs ${
                  isActive
                    ? 'bg-neutral-950 text-white'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                }`}
              >
                <span suppressHydrationWarning>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
