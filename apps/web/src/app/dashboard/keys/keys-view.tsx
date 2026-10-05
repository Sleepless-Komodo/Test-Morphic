'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { deleteApiKey } from '@/lib/actions';
import { timeAgo } from '@/lib/utils';
import {
  ArrowUpRight,
  KeyRound,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';

const maskedKey = (prefix: string) => `${(prefix || 'mp-live-').slice(0, 10)}••••••••••••••••`;

interface KeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  expiresAt?: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

interface KeysViewProps {
  initialKeys: KeyItem[];
}

export function KeysView({ initialKeys }: KeysViewProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const isId = locale === 'id';
  const [keys, setKeys] = useState<KeyItem[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [expiresIn, setExpiresIn] = useState<'none' | '30d' | '90d'>('none');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();


  const MAX_KEYS = 5;
  const isAtLimit = keys.length >= MAX_KEYS;

  // Minting goes straight to the gateway through the /api/backend proxy instead of a
  // Server Action: the proxy re-derives the Authorization header from the session, and a
  // route handler keeps working for tabs opened before a deploy (action ids rotate).
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    if (isAtLimit) {
      setCreateError(
        isId
          ? `Batas kuota tercapai: Anda sudah memiliki ${MAX_KEYS}/${MAX_KEYS} API key. Hapus key yang tidak terpakai jika ingin membuat yang baru.`
          : `Quota reached: You already have ${MAX_KEYS}/${MAX_KEYS} API keys. Delete an unused key if you need to create a new one.`
      );
      return;
    }

    const name = newKeyName.trim();
    if (!name) {
      // The submit button used to be disabled here, so an empty field made the click do
      // nothing with no explanation. Say what is missing instead.
      setCreateError(
        isId ? 'Kasih nama dulu buat key ini.' : 'Give the key a name first.',
      );
      nameInputRef.current?.focus();
      return;
    }

    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await fetch('/api/backend/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, expiresIn }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.key) {
        setCreateError(
          body?.error?.message ||
            (isId ? 'Gagal membuat key. Coba lagi.' : 'Could not create the key. Try again.'),
        );
        return;
      }

      setCreatedRawKey(body.key);
      setKeys((prev) => [
        {
          id: body.id,
          name: body.name,
          keyPrefix: body.prefix,
          status: body.status,
          expiresAt: body.expires_at ? new Date(body.expires_at) : null,
          lastUsedAt: null,
          createdAt: body.created_at ? new Date(body.created_at) : new Date(),
        },
        ...prev,
      ]);
      setNewKeyName('');
    } catch {
      setCreateError(
        isId
          ? 'Tidak bisa menghubungi server. Cek koneksi lalu coba lagi.'
          : 'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Permanent delete: the row is gone, so the gateway rejects the key on its very next request.
  const handleDelete = (id: string) => {
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteApiKey(id);
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        router.refresh();
      } else {
        setDeleteError(res.error || (isId ? 'Gagal menghapus key. Coba lagi.' : 'Could not delete the key. Try again.'));
      }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/70 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 suppressHydrationWarning className="text-2xl md:text-3xl font-heading font-extrabold text-neutral-950 tracking-tight">
              {t.dashboard.keysPageTitle}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${
              isAtLimit
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-neutral-100 text-neutral-700 border-neutral-200'
            }`}>
              {keys.length}/{MAX_KEYS} Keys
            </span>
          </div>
          <p suppressHydrationWarning className="text-xs md:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
            {t.dashboard.keysPageSubtitle}
          </p>
        </div>
      </div>

      {/* Create Key Card */}
      <div className="p-6 rounded-3xl bg-white border border-neutral-200/90 shadow-xs space-y-4">
        {isAtLimit && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/90 text-xs text-amber-900 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {isId
                ? `Batas maksimal 5 API key telah tercapai (${keys.length}/${MAX_KEYS}). Hapus key lama di bawah untuk membuat key baru.`
                : `Maximum limit of 5 API keys reached (${keys.length}/${MAX_KEYS}). Delete an unused key below to create a new one.`}
            </span>
          </div>
        )}

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            ref={nameInputRef}
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            disabled={isCreating || isAtLimit}
            placeholder={isAtLimit ? (isId ? 'Batas maksimal 5 key tercapai' : 'Max 5 keys limit reached') : t.dashboard.keyNameInputPlaceholder}
            aria-label={t.dashboard.keyNameInputPlaceholder}
            aria-invalid={createError ? true : undefined}
            aria-describedby={createError ? 'create-key-error' : undefined}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value as any)}
            disabled={isCreating || isAtLimit}
            aria-label={locale === 'en' ? 'API key expiration duration' : 'Masa berlaku kunci API'}
            className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-800 focus:outline-none focus:border-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-950 transition-colors shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="none">{t.dashboard.expiryNever}</option>
            <option value="30d">{t.dashboard.expiry30Days}</option>
            <option value="90d">{t.dashboard.expiry90Days}</option>
          </select>
          <button
            type="submit"
            disabled={isCreating || isAtLimit}
            className="px-5 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 active:scale-95"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{isCreating ? t.dashboard.creatingKeyBtn : t.dashboard.createKeyBtn}</span>
          </button>
        </form>

        {createError && (
          <p id="create-key-error" role="alert" className="flex items-start gap-2 text-xs text-red-700">
            <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-600" />
            <span>{createError}</span>
          </p>
        )}

        {/* Revealed Key Banner */}
        {createdRawKey && (
          <div className="p-4 rounded-2xl bg-neutral-900 text-white border border-neutral-800 shadow-md space-y-3 animate-in fade-in slide-in-from-top-3 duration-250 ease-out">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
              <ShieldCheck className="h-4 w-4" />
              <span>{t.dashboard.revealKeyPrompt}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <code className="font-mono text-xs text-neutral-200 flex-1 break-all select-all">
                {createdRawKey}
              </code>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyToClipboard(createdRawKey)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>{t.dashboard.revealKeyWarning}</span>
            </div>
          </div>
        )}
      </div>

      {deleteError && (
        <div role="alert" className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-red-500 hover:text-red-700 p-1 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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
                  <th className="px-6 py-3.5">{t.dashboard.thExpires}</th>
                  <th className="px-6 py-3.5">{t.dashboard.thLastUsed}</th>
                  <th className="px-6 py-3.5">{t.dashboard.thCreated}</th>
                  <th className="px-6 py-3.5 text-right">{t.dashboard.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {keys.map((k) => {
                  return (
                  <tr key={k.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-neutral-900">{k.name}</td>
                    <td className="px-6 py-4 font-mono text-neutral-600">
                      <span className="px-2.5 py-1 rounded-lg border text-xs font-mono bg-neutral-100 text-neutral-600 border-neutral-200">
                        {maskedKey(k.keyPrefix)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {k.status === 'active' && k.expiresAt && new Date(k.expiresAt).getTime() < Date.now() ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          <span suppressHydrationWarning>{t.dashboard.keyStatusExpired}</span>
                        </span>
                      ) : k.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span suppressHydrationWarning>{t.dashboard.keyStatusActive}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-neutral-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0" />
                          <span>{k.status}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px]">
                      {k.expiresAt ? (
                        new Date(k.expiresAt).getTime() < Date.now() ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-red-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            <span>{t.dashboard.keyStatusExpired}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-700 font-semibold" title={new Date(k.expiresAt).toLocaleString(locale === 'en' ? 'en-US' : 'id-ID')}>
                            {new Date(k.expiresAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID')}
                          </span>
                        )
                      ) : (
                        <span className="text-neutral-500">{t.dashboard.keyStatusNever}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-[11px]">
                      {timeAgo(k.lastUsedAt, locale)}
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-mono text-[11px]">
                      {new Date(k.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {confirmDeleteId === k.id ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span className="text-[11px] text-red-600 font-bold">
                            {t.dashboard.revokeConfirm}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleDelete(k.id);
                              setConfirmDeleteId(null);
                            }}
                            disabled={isPending}
                            className="px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold transition-all active:scale-95 shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            {isPending ? '...' : t.dashboard.revokeYes}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isPending}
                            className="px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            {t.dashboard.revokeCancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(k.id)}
                          disabled={isPending}
                          className="px-2.5 py-1 rounded-lg border border-neutral-200 hover:border-red-300 hover:bg-red-50 text-neutral-600 hover:text-red-700 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span suppressHydrationWarning>{t.dashboard.revokeBtn}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Best Practices Callout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-neutral-100 border border-neutral-200/80 text-neutral-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4 text-neutral-700" />
          </div>
          <div className="text-xs text-neutral-600 leading-relaxed">
            <span className="font-bold text-neutral-950 block sm:inline mr-1.5">
              {t.dashboard.keySecurityLabel}
            </span>
            <span>
              {t.dashboard.keySecurityDesc}
            </span>
          </div>
        </div>

        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-xs font-semibold text-neutral-800 hover:text-neutral-950 transition-all shrink-0 self-start sm:self-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
        >
          <span>{t.dashboard.setupGuidesLink}</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-neutral-500" />
        </Link>
      </div>
    </div>
  );
}
