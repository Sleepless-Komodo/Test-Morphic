'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { saveModel, saveModelPoolEntry, type ModelActionResult } from '@/lib/admin-actions';
import { useTranslation } from '@/lib/i18n';

export interface ProviderOption {
  id: string;
  name: string;
}

export interface PoolModelOption {
  id: string;
  publicModelId: string;
  contextLength: number;
}

/** Inline tooltip — accessible via hover and keyboard focus. */
export function Tip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1.5">
      <button
        type="button"
        aria-label={`Info: ${text}`}
        tabIndex={0}
        className="w-3.5 h-3.5 rounded-full bg-neutral-200 text-neutral-600 text-[9px] font-bold flex items-center justify-center leading-none cursor-help hover:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="
          pointer-events-none absolute z-50 left-5 top-1/2 -translate-y-1/2
          w-60 px-3 py-2 rounded-xl
          bg-neutral-950 text-white text-[11px] leading-relaxed
          opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
          transition-opacity duration-150
          shadow-xl border border-neutral-800
        "
      >
        {text}
      </span>
    </span>
  );
}

/** Label + optional tooltip wrapper for admin model forms. */
export function Field({
  label,
  tip,
  children,
  span,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
  span?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${span ?? ''}`}>
      <label className="flex items-center text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500">
        {label}
        {tip && <Tip text={tip} />}
      </label>
      {children}
    </div>
  );
}

/** Dismissible inline success/error toast banner for model actions. */
export function ToastBanner({
  toast,
  onClose,
}: {
  toast: { type: 'success' | 'error'; text: string };
  onClose: () => void;
}) {
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border shadow-2xs mb-4 ${
        toast.type === 'success'
          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
          : 'bg-red-50 text-red-900 border-red-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {toast.type === 'success' ? (
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
        )}
        <span className="font-medium break-words">{toast.text}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup pesan"
        className="text-neutral-500 hover:text-neutral-900 cursor-pointer p-1 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function useModelActionForm(action: (fd: FormData) => Promise<ModelActionResult>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    const fd = new FormData(e.currentTarget);
    setToast(null);
    startTransition(async () => {
      try {
        const res = await action(fd);
        setToast({ type: res.ok ? 'success' : 'error', text: res.message });
        if (res.ok) formRef.current?.reset();
      } catch {
        setToast({
          type: 'error',
          text: 'Gagal menghubungi server. Coba lagi atau periksa koneksi Anda. (kode: client_network)',
        });
      }
    });
  };

  return { formRef, isPending, toast, clearToast: () => setToast(null), handleSubmit };
}

/** Client wrapper for creating a new AI catalog model with inline error/success feedback. */
export function AddModelForm({ providers }: { providers: ProviderOption[] }) {
  const { t } = useTranslation();
  const { formRef, isPending, toast, clearToast, handleSubmit } = useModelActionForm(saveModel);
  const hasProviders = providers.length > 0;

  return (
    <div>
      {toast && <ToastBanner toast={toast} onClose={clearToast} />}
      {!hasProviders && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2"
        >
          <span>Belum ada provider upstream terdaftar. Tambahkan provider terlebih dahulu sebelum membuat model.</span>
          <Link
            href="/admin/providers"
            className="font-semibold underline underline-offset-2 text-amber-950 hover:text-amber-700"
          >
            Buka Providers →
          </Link>
        </div>
      )}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4"
      >
        <Field
          label="Provider"
          tip="Upstream provider that serves this model. Must be registered in the Providers table first."
        >
          <select
            name="providerId"
            aria-label="Provider"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            required
            disabled={!hasProviders || isPending}
            defaultValue={providers[0]?.id ?? ''}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Public Model ID"
          tip="The model ID that external clients send in requests (e.g. deepseek-v4). This is what users put in their SDK config."
        >
          <input
            name="publicModelId"
            aria-label="Public Model ID"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            placeholder="deepseek-v4"
            disabled={isPending}
            required
          />
        </Field>

        <Field
          label="Provider Model ID"
          tip="The actual model ID forwarded to upstream API (e.g. deepseek-chat). Check provider documentation."
        >
          <input
            name="providerModelId"
            aria-label="Provider Model ID"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            placeholder="deepseek-chat"
            disabled={isPending}
            required
          />
        </Field>

        <Field
          label="Display Name"
          tip="Human-readable name shown in dashboard UI and model picker."
        >
          <input
            name="displayName"
            aria-label="Display Name"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            placeholder="DeepSeek V4"
            disabled={isPending}
            required
          />
        </Field>

        <Field
          label="Description"
          tip="Short description of what this model is good for."
          span="col-span-2"
        >
          <input
            name="description"
            aria-label="Description"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            placeholder="Fast and affordable coding model by DeepSeek"
            disabled={isPending}
          />
        </Field>

        <Field
          label="Capabilities"
          tip="Comma-separated: coding, reasoning, chat, multimodal, vision."
          span="col-span-2"
        >
          <input
            name="capabilities"
            aria-label="Capabilities"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            placeholder="coding, reasoning"
            disabled={isPending}
          />
        </Field>

        <Field
          label="Context Length (tokens)"
          tip="Maximum context window in tokens. ≥128K = Long Context badge."
        >
          <input
            name="contextLength"
            aria-label="Context Length in tokens"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            type="number"
            placeholder="65536"
            min={1024}
            step={1}
            disabled={isPending}
            required
          />
        </Field>

        <Field
          label="Input Credits / 1M"
          tip="Credits charged per 1 million input (prompt) tokens."
        >
          <input
            name="inputCreditsPer1m"
            aria-label="Input credits per 1 million tokens"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            type="number"
            placeholder="100"
            min={1}
            step={1}
            disabled={isPending}
            required
          />
        </Field>

        <Field
          label="Output Credits / 1M"
          tip="Credits charged per 1 million output (completion) tokens."
        >
          <input
            name="outputCreditsPer1m"
            aria-label="Output credits per 1 million tokens"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            type="number"
            placeholder="300"
            min={1}
            step={1}
            disabled={isPending}
            required
          />
        </Field>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!hasProviders || isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.admin.models.processingBtn}</span>
              </>
            ) : (
              <span>{t.admin.models.createBtn}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Client wrapper for adding/updating a `model_provider_pool` entry with inline feedback. */
export function AddPoolEntryForm({
  models,
  providers,
}: {
  models: PoolModelOption[];
  providers: ProviderOption[];
}) {
  const { t } = useTranslation();
  const { formRef, isPending, toast, clearToast, handleSubmit } = useModelActionForm(saveModelPoolEntry);

  return (
    <div>
      {toast && <ToastBanner toast={toast} onClose={clearToast} />}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4 pb-5 border-b border-neutral-100"
      >
        <Field label="Public Model" tip="Model publik yang akan dilayani oleh kandidat pool ini.">
          <select
            name="modelId"
            aria-label="Pool Public Model"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            disabled={isPending}
            required
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.publicModelId} (ctx {m.contextLength})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Provider / Key Slot" tip="Pilih provider atau akun key spesifik dari tabel Providers.">
          <select
            name="providerId"
            aria-label="Pool Provider"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-60"
            disabled={isPending}
            required
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Upstream Model ID" tip="ID model yang dikirim ke provider upstream tersebut.">
          <input
            name="providerModelId"
            aria-label="Pool Upstream Model ID"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono disabled:opacity-60"
            placeholder="deepseek-ai/DeepSeek-V3"
            disabled={isPending}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Priority" tip="1 = tier utama; angka lebih besar = tier failover.">
            <input
              name="priority"
              type="number"
              min={1}
              defaultValue={1}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono disabled:opacity-60"
              disabled={isPending}
              required
            />
          </Field>
          <Field label="Weight" tip="Bobot distribusi beban pada tier priority yang sama.">
            <input
              name="weight"
              type="number"
              min={1}
              defaultValue={100}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono disabled:opacity-60"
              disabled={isPending}
              required
            />
          </Field>
        </div>

        <Field label="Context Length" tip="Wajib >= context length model publik (aturan D9). Kosongkan untuk mengikuti model.">
          <input
            name="contextLength"
            type="number"
            min={1024}
            step={1}
            placeholder="Ikuti model"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono disabled:opacity-60"
            disabled={isPending}
          />
        </Field>

        <Field label="Cost Input / 1M" tip="Biaya modal upstream input (opsional, untuk tracking margin per provider).">
          <input
            name="costInputPer1m"
            type="number"
            min={0}
            placeholder="Opsional"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono disabled:opacity-60"
            disabled={isPending}
          />
        </Field>

        <Field label="Cost Output / 1M" tip="Biaya modal upstream output (opsional, untuk tracking margin per provider).">
          <input
            name="costOutputPer1m"
            type="number"
            min={0}
            placeholder="Opsional"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono disabled:opacity-60"
            disabled={isPending}
          />
        </Field>

        <div className="flex flex-col justify-end gap-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-neutral-700">
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="checkbox" name="supportsTools" defaultChecked disabled={isPending} />
              tools
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="checkbox" name="supportsParallelTools" defaultChecked disabled={isPending} />
              parallel
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="checkbox" name="supportsVision" disabled={isPending} />
              vision
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="checkbox" name="supportsReasoning" disabled={isPending} />
              reasoning
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="checkbox" name="reasoningEchoRequired" disabled={isPending} />
              echo_req
            </label>
            <input type="hidden" name="usageInStream" value="true" />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.admin.models.processingBtn}</span>
              </>
            ) : (
              <span>Simpan Pool Entry</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
