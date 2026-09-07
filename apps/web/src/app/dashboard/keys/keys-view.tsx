'use client';

import { useState, useTransition } from 'react';
import { useTranslation } from '@/lib/i18n';
import { createApiKey, revokeApiKey } from '@/lib/actions';
import { timeAgo } from '@/lib/utils';
import { KeyRound, Copy, Check, ShieldAlert, Sparkles, Terminal, Trash2 } from 'lucide-react';

const maskedKey = (prefix: string) => `${(prefix || 'mp-live-').slice(0, 10)}••••••••••••••••`;

interface KeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export function KeysView({ initialKeys }: { initialKeys: KeyItem[] }) {
  const { t, locale } = useTranslation();
  const [keys, setKeys] = useState<KeyItem[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set('name', newKeyName.trim());
      const res = await createApiKey({ raw: null }, fd);
      if (res.raw) {
        setCreatedRawKey(res.raw);
        const hex = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        setKeys((prev) => [
          {
            id: `k-${Date.now()}`,
            name: newKeyName.trim(),
            keyPrefix: `mp-${hex}`,
            status: 'active',
            lastUsedAt: null,
            createdAt: new Date(),
          },
          ...prev,
        ]);
        setNewKeyName('');
      }
    });
  };

  const handleRevoke = (id: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await revokeApiKey(fd);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200/70 pb-4">
        <div suppressHydrationWarning className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold mb-1">
          {locale === 'en' ? 'Morphic Developer Console / Authentication' : 'Morphic Developer Console / Autentikasi'}
        </div>
        <h1 suppressHydrationWarning className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
          {t.dashboard.keysPageTitle}
        </h1>
        <p suppressHydrationWarning className="text-xs md:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
          {t.dashboard.keysPageSubtitle}
        </p>
      </div>

      {/* Create Key Card */}
      <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-xs space-y-4">
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t.dashboard.keyNameInputPlaceholder}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-black transition-colors"
          />
          <button
            type="submit"
            disabled={isPending || !newKeyName.trim()}
            className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{isPending ? t.dashboard.creatingKeyBtn : t.dashboard.createKeyBtn}</span>
          </button>
        </form>

        {/* Revealed Key Banner */}
        {createdRawKey && (
          <div className="p-4 rounded-2xl bg-neutral-900 text-white border border-neutral-800 shadow-md space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
              <Sparkles className="h-4 w-4" />
              <span>{t.dashboard.revealKeyPrompt}</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <code className="font-mono text-xs text-neutral-200 flex-1 break-all select-all">
                {createdRawKey}
              </code>
              <button
                onClick={() => copyToClipboard(createdRawKey)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">{t.dashboard.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t.dashboard.copy}</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>{t.dashboard.revealKeyWarning}</span>
            </div>
          </div>
        )}
      </div>

      {/* Keys Table Card */}
      <div className="rounded-3xl bg-white border border-neutral-200/90 shadow-xs overflow-hidden">
        {keys.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-500">
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="text-xs text-neutral-500 max-w-sm mx-auto">
              {t.dashboard.noKeysFound}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr suppressHydrationWarning className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                  <th className="px-6 py-3.5">{t.dashboard.thName}</th>
                  <th className="px-6 py-3.5">{t.dashboard.thKey}</th>
                  <th className="px-6 py-3.5">{t.dashboard.thStatus}</th>
                  <th className="px-6 py-3.5">{t.dashboard.thLastUsed}</th>
                  <th className="px-6 py-3.5">{t.dashboard.thCreated}</th>
                  <th className="px-6 py-3.5 text-right">{t.dashboard.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-neutral-900">{k.name}</td>
                    <td className="px-6 py-4 font-mono text-neutral-600">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200">
                        {maskedKey(k.keyPrefix)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span suppressHydrationWarning>{k.status === 'active' ? (locale === 'en' ? 'Active' : 'Aktif') : k.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-[11px]">
                      {timeAgo(k.lastUsedAt)}
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-[11px]">
                      {new Date(k.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:border-red-300 hover:bg-red-50 text-neutral-600 hover:text-red-700 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span suppressHydrationWarning>{t.dashboard.revokeBtn}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Integration Guide Bento Card */}
      <div className="p-6 rounded-3xl bg-neutral-950 text-white border border-neutral-800 shadow-md space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
          <Terminal className="h-4 w-4 text-neutral-400" />
          <span suppressHydrationWarning>{t.dashboard.quickstartTitle}</span>
        </div>
        <p suppressHydrationWarning className="text-xs text-neutral-400 leading-relaxed">
          {t.dashboard.quickstartDesc}
        </p>
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 font-mono text-xs text-neutral-300 space-y-1 overflow-x-auto">
          <div><span suppressHydrationWarning className="text-neutral-500">{locale === 'en' ? '# Cursor / Cline / Windsurf OpenAI Override:' : '# Konfigurasi Override OpenAI di Cursor / Cline / Windsurf:'}</span></div>
          <div><span className="text-emerald-400">OPENAI_BASE_URL</span>=https://api.morphic.sh/v1</div>
          <div><span className="text-emerald-400">OPENAI_API_KEY</span>=mp-live-xxxxxxxxxxxxxxxxxxxx</div>
        </div>
      </div>
    </div>
  );
}
