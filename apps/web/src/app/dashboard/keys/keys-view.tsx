'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { createApiKey, revokeApiKey } from '@/lib/actions';
import { timeAgo } from '@/lib/utils';
import { ArrowUpRight, KeyRound, Copy, Check, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';

const maskedKey = (prefix: string) => `${(prefix || 'mp-live-').slice(0, 10)}••••••••••••••••`;

interface KeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

function CopyPrefixButton({ prefix }: { prefix: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(prefix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Salin Prefix Kunci"
      className="p-1 rounded hover:bg-neutral-200/60 text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function KeysView({ initialKeys }: { initialKeys: KeyItem[] }) {
  const { t, locale } = useTranslation();
  const [keys, setKeys] = useState<KeyItem[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
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
        const actualPrefix = (res as any).prefix || res.raw.slice(0, 16);
        const realId = (res as any).id || `k-${Date.now()}`;
        setKeys((prev) => [
          {
            id: realId,
            name: newKeyName.trim(),
            keyPrefix: actualPrefix,
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
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200/70 pb-4">
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
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-neutral-950/20 transition-colors"
          />
          <button
            type="submit"
            disabled={isPending || !newKeyName.trim()}
            className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 active:scale-95"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{isPending ? t.dashboard.creatingKeyBtn : t.dashboard.createKeyBtn}</span>
          </button>
        </form>

        {/* Revealed Key Banner */}
        {createdRawKey && (
          <div className="p-4 rounded-2xl bg-neutral-900 text-white border border-neutral-800 shadow-md space-y-3 animate-in fade-in slide-in-from-top-3 duration-250 ease-out">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
              <ShieldCheck className="h-4 w-4" />
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
                      <div className="inline-flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200">
                          {maskedKey(k.keyPrefix)}
                        </span>
                        <CopyPrefixButton prefix={k.keyPrefix} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {k.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                          <span suppressHydrationWarning>{locale === 'en' ? 'Active' : 'Aktif'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                          <span>{k.status}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-[11px]">
                      {timeAgo(k.lastUsedAt, locale)}
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-[11px]">
                      {new Date(k.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {confirmRevokeId === k.id ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span className="text-[11px] text-red-600 font-bold">
                            {locale === 'en' ? 'Revoke?' : 'Cabut?'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleRevoke(k.id);
                              setConfirmRevokeId(null);
                            }}
                            disabled={isPending}
                            className="px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
                          >
                            {locale === 'en' ? 'Yes' : 'Ya'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRevokeId(null)}
                            disabled={isPending}
                            className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-semibold transition-all active:scale-95 cursor-pointer"
                          >
                            {locale === 'en' ? 'Cancel' : 'Batal'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(k.id)}
                          className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:border-red-300 hover:bg-red-50 text-neutral-600 hover:text-red-700 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span suppressHydrationWarning>{t.dashboard.revokeBtn}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Best Practices & Documentation Callout (OpenAI / Groq Standard) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-neutral-100 border border-neutral-200/80 text-neutral-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4 text-neutral-700" />
          </div>
          <div className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-950 block sm:inline mr-1.5">
              {locale === 'id' ? 'Keamanan Kunci API:' : 'API Key Security:'}
            </span>
            <span>
              {locale === 'id'
                ? 'Jangan pernah membagikan kunci rahasia Anda atau menyimpannya di repository publik. Selalu gunakan environment variable (.env) lokal.'
                : 'Do not share your secret key with others, or commit it to public repositories. Always use local environment variables.'}
            </span>
          </div>
        </div>

        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-xs font-semibold text-neutral-800 hover:text-neutral-950 transition-all shrink-0 self-start sm:self-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
        >
          <span>{locale === 'id' ? 'Panduan Setup IDE' : 'Setup Guides'}</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-neutral-500" />
        </Link>
      </div>
    </div>
  );
}
