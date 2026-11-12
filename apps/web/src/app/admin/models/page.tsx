import { asc, eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import {
  saveModel,
  saveModelPoolEntry,
  toggleModelPoolEntry,
  deleteModelPoolEntry,
} from '@/lib/admin-actions';
import { hasAdminPermission } from '@morphic/shared/admin-rbac';
import { getServerTranslation } from '@/lib/i18n/server';
import { readyModelIds } from '@morphic/shared/model-readiness';
import { ModelsTable } from './models-table';
import { Cpu, Layers, Plus, Trash2 } from 'lucide-react';

/** Inline tooltip — accessible via hover and keyboard focus */
function Tip({ text }: { text: string }) {
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

/** Label + optional tooltip wrapper */
function Field({
  label,
  tip,
  children,
  span,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
  span?: 'col-span-2' | 'col-span-full';
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

export default async function AdminModels() {
  const admin = await requireAdmin('catalog:read');
  const canWrite = hasAdminPermission(admin.role, 'catalog:write');
  const { t } = await getServerTranslation();

  const [models, providers, poolEntries] = await Promise.all([
    db
      .select({
        id: s.models.id,
        providerId: s.models.providerId,
        publicModelId: s.models.publicModelId,
        providerModelId: s.models.providerModelId,
        displayName: s.models.displayName,
        description: s.models.description,
        contextLength: s.models.contextLength,
        capabilities: s.models.capabilities,
        inputCreditsPer1m: s.models.inputCreditsPer1m,
        outputCreditsPer1m: s.models.outputCreditsPer1m,
        providerCostInputPer1m: s.models.providerCostInputPer1m,
        providerCostOutputPer1m: s.models.providerCostOutputPer1m,
        status: s.models.status,
        providerName: s.providers.name,
        fallbackProviderId: s.models.fallbackProviderId,
      })
      .from(s.models)
      .innerJoin(s.providers, eq(s.models.providerId, s.providers.id)),
    db.select().from(s.providers),
    db
      .select({
        id: s.modelProviderPool.id,
        modelId: s.modelProviderPool.modelId,
        publicModelId: s.models.publicModelId,
        providerId: s.modelProviderPool.providerId,
        providerName: s.providers.name,
        providerModelId: s.modelProviderPool.providerModelId,
        priority: s.modelProviderPool.priority,
        weight: s.modelProviderPool.weight,
        contextLength: s.modelProviderPool.contextLength,
        costInputPer1m: s.modelProviderPool.costInputPer1m,
        costOutputPer1m: s.modelProviderPool.costOutputPer1m,
        supportsTools: s.modelProviderPool.supportsTools,
        supportsVision: s.modelProviderPool.supportsVision,
        supportsReasoning: s.modelProviderPool.supportsReasoning,
        reasoningEchoRequired: s.modelProviderPool.reasoningEchoRequired,
        isEnabled: s.modelProviderPool.isEnabled,
      })
      .from(s.modelProviderPool)
      .innerJoin(s.models, eq(s.modelProviderPool.modelId, s.models.id))
      .innerJoin(s.providers, eq(s.modelProviderPool.providerId, s.providers.id))
      .orderBy(asc(s.models.publicModelId), asc(s.modelProviderPool.priority)),
  ]);
  const pool = poolEntries.map((r) => ({
    modelId: r.modelId,
    providerId: r.providerId,
    isEnabled: r.isEnabled,
  }));
  const ready = readyModelIds(models, providers, pool);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-5 border-b border-neutral-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-neutral-950 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-neutral-700" />
            {t.admin.models.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            {t.admin.models.desc}
          </p>
        </div>
      </div>

      {/* Add Model Card */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100">
          <Plus className="w-4 h-4 text-neutral-700" />
          <h2 className="text-sm font-heading font-bold text-neutral-950">{t.admin.models.addTitle}</h2>
        </div>
        <form action={saveModel} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
          {/* Row 1 */}
          <Field
            label="Provider"
            tip="Upstream provider that serves this model. Must be registered in the Providers table first."
          >
            <select
              name="providerId"
              aria-label="Provider"
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              required
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
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              placeholder="deepseek-v4"
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
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              placeholder="deepseek-chat"
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
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              placeholder="DeepSeek V4"
              required
            />
          </Field>

          {/* Row 2 */}
          <Field
            label="Description"
            tip="Short description of what this model is good for."
            span="col-span-2"
          >
            <input
              name="description"
              aria-label="Description"
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              placeholder="Fast and affordable coding model by DeepSeek"
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
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              placeholder="coding, reasoning"
            />
          </Field>

          {/* Row 3 */}
          <Field
            label="Context Length (tokens)"
            tip="Maximum context window in tokens. ≥128K = Long Context badge."
          >
            <input
              name="contextLength"
              aria-label="Context Length in tokens"
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              type="number"
              placeholder="65536"
              min={1024}
              step={1024}
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
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              type="number"
              placeholder="100"
              min={1}
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
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              type="number"
              placeholder="300"
              min={1}
              required
            />
          </Field>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 cursor-pointer shadow-xs"
            >
              {t.admin.models.createBtn}
            </button>
          </div>
        </form>
      </div>

      {/* Model Table */}
      <ModelsTable models={models.map(({ fallbackProviderId: _f, ...m }) => ({ ...m, ready: ready.has(m.id) }))} providers={providers.map((p) => ({ id: p.id, name: p.name }))} />

      {/* Provider Pool (N-way Routing & Multi-Key Failover) */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-heading font-bold text-neutral-950 flex items-center gap-2">
              <Layers className="w-4 h-4 text-neutral-700" />
              Provider Pool (Multi-Provider &amp; Multi-Key Routing)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Routing pool aktif secara default. Untuk multi-key dari vendor yang sama, daftarkan tiap API key sebagai baris terpisah di menu Providers (misal <code className="font-mono">chutes-1</code>, <code className="font-mono">chutes-2</code>) lalu masukkan ke pool model di bawah.
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-semibold">
            {poolEntries.length} pool entries
          </span>
        </div>

        {canWrite && models.length > 0 && providers.length > 0 && (
          <form
            action={saveModelPoolEntry}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4 pb-5 border-b border-neutral-100"
          >
            <Field label="Public Model" tip="Model publik yang akan dilayani oleh kandidat pool ini.">
              <select
                name="modelId"
                aria-label="Pool Public Model"
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
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
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
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
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono"
                placeholder="deepseek-ai/DeepSeek-V3"
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
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono"
                  required
                />
              </Field>
              <Field label="Weight" tip="Bobot distribusi beban pada tier priority yang sama.">
                <input
                  name="weight"
                  type="number"
                  min={1}
                  defaultValue={100}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono"
                  required
                />
              </Field>
            </div>

            <Field label="Context Length" tip="Wajib >= context length model publik (aturan D9). Kosongkan untuk mengikuti model.">
              <input
                name="contextLength"
                type="number"
                min={1024}
                step={1024}
                placeholder="Ikuti model"
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono"
              />
            </Field>

            <Field label="Cost Input / 1M" tip="Biaya modal upstream input (opsional, untuk tracking margin per provider).">
              <input
                name="costInputPer1m"
                type="number"
                min={0}
                placeholder="Opsional"
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono"
              />
            </Field>

            <Field label="Cost Output / 1M" tip="Biaya modal upstream output (opsional, untuk tracking margin per provider).">
              <input
                name="costOutputPer1m"
                type="number"
                min={0}
                placeholder="Opsional"
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 font-mono"
              />
            </Field>

            <div className="flex flex-col justify-end gap-2">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-neutral-700">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" name="supportsTools" defaultChecked />
                  tools
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" name="supportsParallelTools" defaultChecked />
                  parallel
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" name="supportsVision" />
                  vision
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" name="supportsReasoning" />
                  reasoning
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" name="reasoningEchoRequired" />
                  echo_req
                </label>
                <input type="hidden" name="usageInStream" value="true" />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-950 text-white hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
              >
                Simpan Pool Entry
              </button>
            </div>
          </form>
        )}

        {poolEntries.length === 0 ? (
          <p className="text-xs text-neutral-500 py-3 text-center">
            Belum ada entri pool. Model tanpa entri pool otomatis memakai provider utama / fallback.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50/60">
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-2.5 px-3">Model</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-2.5 px-3">Provider</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-2.5 px-3">Upstream ID</th>
                  <th className="text-right font-mono font-semibold uppercase tracking-wider text-neutral-500 py-2.5 px-3">Prio / Wt</th>
                  <th className="text-right font-mono font-semibold uppercase tracking-wider text-neutral-500 py-2.5 px-3">Ctx</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-2.5 px-3">Caps</th>
                  <th className="text-left font-mono font-semibold uppercase tracking-wider text-neutral-500 py-2.5 px-3">Status</th>
                  {canWrite && (
                    <th className="text-right font-mono font-semibold uppercase tracking-wider text-neutral-500 py-2.5 px-3">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {poolEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50/60">
                    <td className="py-2.5 px-3 font-mono font-semibold text-neutral-950">{entry.publicModelId}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-800">{entry.providerName}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">{entry.providerModelId}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-800">
                      P{entry.priority} · {entry.weight}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                      {entry.contextLength != null ? entry.contextLength.toLocaleString() : 'model'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-neutral-600">
                      {[
                        entry.supportsTools && 'tools',
                        entry.supportsVision && 'vision',
                        entry.supportsReasoning && 'reasoning',
                        entry.reasoningEchoRequired && 'echo',
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {entry.isEnabled ? (
                        <span className="text-emerald-700 font-semibold">enabled</span>
                      ) : (
                        <span className="text-neutral-400">disabled</span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <form action={toggleModelPoolEntry}>
                            <input type="hidden" name="id" value={entry.id} />
                            <button
                              type="submit"
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-800 cursor-pointer"
                            >
                              {entry.isEnabled ? 'Disable' : 'Enable'}
                            </button>
                          </form>
                          <form action={deleteModelPoolEntry}>
                            <input type="hidden" name="id" value={entry.id} />
                            <button
                              type="submit"
                              aria-label={`Delete pool entry ${entry.providerName}`}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
