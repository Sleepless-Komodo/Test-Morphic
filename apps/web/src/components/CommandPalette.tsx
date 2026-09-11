'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bot,
  Copy,
  Check,
  Compass,
  Code2,
  Globe,
  KeyRound,
  LayoutDashboard,
  Coins,
  FileText,
  Terminal,
  X,
  ArrowRight,
} from 'lucide-react';
import { ALL_MODELS } from '@/lib/models-data';
import { useTranslation } from '@/lib/i18n';
import { API_BASE_URL } from '@/lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  section: 'models' | 'navigation' | 'snippets' | 'locale';
  sectionLabel: string;
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  keywords?: string;
}

const emptySubscribe = () => () => {};

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { locale, setLocale } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setQuery('');
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global keydown listener for Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyToClipboard = useCallback(
    (text: string, itemId: string) => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setCopiedId(itemId);
        setTimeout(() => {
          setCopiedId(null);
          onClose();
        }, 700);
      }
    },
    [onClose]
  );

  // Build items catalog
  const items: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = [];

    // 1. AI Models
    ALL_MODELS.forEach((m) => {
      list.push({
        id: `model-${m.id}`,
        section: 'models',
        sectionLabel: locale === 'en' ? 'AI Models' : 'Model AI',
        title: m.name,
        subtitle: `${m.provider} · ${m.contextWindow} · ${m.estimatedLatency}`,
        badge: m.id,
        icon: Bot,
        keywords: `${m.name} ${m.provider} ${m.id} ${m.category}`,
        onSelect: () => {
          copyToClipboard(m.id, `model-${m.id}`);
        },
      });
    });

    // 2. Navigation
    const navs = [
      { path: '/', title: locale === 'en' ? 'Home' : 'Beranda', sub: 'Landing page overview', icon: Compass },
      { path: '/models', title: locale === 'en' ? 'Model Catalog' : 'Katalog Model', sub: 'Explore all AI models & pricing', icon: Bot },
      { path: '/pricing', title: locale === 'en' ? 'Pricing & Packages' : 'Harga & Paket Saldo', sub: 'Pay-as-you-go credit packages', icon: Coins },
      { path: '/docs', title: locale === 'en' ? 'Documentation' : 'Dokumentasi API', sub: 'API schemas, SDKs & guides', icon: FileText },
      { path: '/dashboard', title: 'Dashboard', sub: 'Overview metrics & stats', icon: LayoutDashboard },
      { path: '/dashboard/keys', title: locale === 'en' ? 'API Keys' : 'Kunci API', sub: 'Generate & manage secret tokens', icon: KeyRound },
      { path: '/dashboard/usage', title: locale === 'en' ? 'Usage & Logs' : 'Penggunaan & Log', sub: 'Real-time telemetry and spend', icon: Terminal },
      { path: '/dashboard/billing', title: locale === 'en' ? 'Billing & Top-up' : 'Top-up Saldo QRIS', sub: 'Instant QRIS payment & history', icon: Coins },
    ];

    navs.forEach((n) => {
      list.push({
        id: `nav-${n.path}`,
        section: 'navigation',
        sectionLabel: locale === 'en' ? 'Navigation' : 'Navigasi',
        title: n.title,
        subtitle: n.sub,
        badge: n.path,
        icon: n.icon,
        keywords: `${n.title} ${n.sub} ${n.path}`,
        onSelect: () => {
          router.push(n.path);
          onClose();
        },
      });
    });

    // 3. Quick Code Snippets
    list.push({
      id: 'snip-base-url',
      section: 'snippets',
      sectionLabel: locale === 'en' ? 'Quick Actions' : 'Tindakan Cepat',
      title: 'Copy Base URL',
      subtitle: API_BASE_URL,
      badge: 'OpenAI Schema',
      icon: Code2,
      keywords: 'base_url api endpoint url host morphic',
      onSelect: () => {
        copyToClipboard(API_BASE_URL, 'snip-base-url');
      },
    });

    list.push({
      id: 'snip-curl',
      section: 'snippets',
      sectionLabel: locale === 'en' ? 'Quick Actions' : 'Tindakan Cepat',
      title: 'Copy cURL Snippet',
      subtitle: `curl ${API_BASE_URL}/chat/completions ...`,
      badge: 'Terminal',
      icon: Terminal,
      keywords: 'curl bash terminal request chat completions',
      onSelect: () => {
        const curl = `curl ${API_BASE_URL}/chat/completions \\\n  -H "Authorization: Bearer YOUR_MORPHIC_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "deepseek-v4", "messages": [{"role": "user", "content": "Hello Morphic"}]}'`;
        copyToClipboard(curl, 'snip-curl');
      },
    });

    list.push({
      id: 'snip-cursor',
      section: 'snippets',
      sectionLabel: locale === 'en' ? 'Quick Actions' : 'Tindakan Cepat',
      title: 'Copy Cursor IDE Base URL',
      subtitle: 'Paste in Cursor Settings > Models > OpenAI API Key',
      badge: 'Cursor',
      icon: Code2,
      keywords: 'cursor ide windsurf cline setup config',
      onSelect: () => {
        copyToClipboard(API_BASE_URL, 'snip-cursor');
      },
    });

    // 4. Locale switch
    list.push({
      id: 'locale-toggle',
      section: 'locale',
      sectionLabel: locale === 'en' ? 'Preferences' : 'Preferensi',
      title: locale === 'en' ? 'Ganti Bahasa ke Indonesia' : 'Switch Language to English',
      subtitle: locale === 'en' ? 'Tampilkan seluruh antarmuka dalam Bahasa Indonesia' : 'Display interface in English',
      badge: locale === 'en' ? 'ID' : 'EN',
      icon: Globe,
      keywords: 'language bahasa indonesia english locale translate',
      onSelect: () => {
        setLocale(locale === 'en' ? 'id' : 'en');
        onClose();
      },
    });

    return list;
  }, [locale, router, onClose, copyToClipboard, setLocale]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.badge && item.badge.toLowerCase().includes(q)) ||
        (item.keywords && item.keywords.toLowerCase().includes(q))
    );
  }, [items, query]);

  // Keyboard navigation within list
  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onSelect();
      }
    }
  };

  // Keep highlighted item in view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[14vh] sm:pt-[16vh] px-4">
        {/* Full-screen smooth backdrop blur covering 100% of viewport without clipping */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 bg-neutral-950/45 backdrop-blur-md"
        />

        {/* Solid, sharp Command Dialog Box (Linear/Raycast aesthetic) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          onKeyDown={handleKeyDownList}
          className="relative w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-[0_24px_64px_-12px_rgba(0,0,0,0.22),0_0_0_1px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col z-10"
        >
          {/* Top Search Input Bar */}
          <div className="flex items-center gap-3 px-4.5 py-3.5 border-b border-neutral-100 bg-white">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder={
                locale === 'en'
                  ? 'Search models, docs, actions, or jump to page...'
                  : 'Cari model, docs, tindakan, atau buka halaman...'
              }
              className="w-full bg-transparent text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-[10px] font-mono font-medium text-neutral-500">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div
            ref={listRef}
            className="max-h-[380px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-200"
          >
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-neutral-400">
                {locale === 'en' ? `No results found for "${query}"` : `Tidak ada hasil untuk "${query}"`}
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                const isCopied = copiedId === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    data-index={idx}
                    type="button"
                    onClick={item.onSelect}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-100/90 text-neutral-950 font-medium'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                          isSelected
                            ? 'bg-white border-neutral-300 text-neutral-900 shadow-2xs'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-500'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-neutral-900 truncate">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-semibold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-200">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <span className="text-[11px] text-neutral-500 truncate mt-0.5">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 pl-2">
                      {isCopied ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600">
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </span>
                      ) : item.section === 'models' || item.section === 'snippets' ? (
                        <Copy
                          className={`w-3.5 h-3.5 ${
                            isSelected ? 'text-neutral-700' : 'text-neutral-300'
                          }`}
                        />
                      ) : (
                        <ArrowRight
                          className={`w-3.5 h-3.5 ${
                            isSelected ? 'text-neutral-700' : 'text-neutral-300'
                          }`}
                        />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Navigation Hints */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-neutral-100 bg-neutral-50/70 text-[11px] font-mono text-neutral-400">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-white border border-neutral-200 text-[9px] font-medium text-neutral-600">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-[9px] font-medium text-neutral-600">
                  ↵
                </kbd>
                <span>Select / Copy</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Morphic</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
