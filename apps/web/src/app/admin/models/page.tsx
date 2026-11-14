import { asc, eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { toggleModelPoolEntry, deleteModelPoolEntry } from '@/lib/admin-actions';
import { hasAdminPermission } from '@morphic/shared/admin-rbac';
import { getServerTranslation } from '@/lib/i18n/server';
import { readyModelIds } from '@morphic/shared/model-readiness';
import { ModelsTable } from './models-table';
import { AddModelForm, AddPoolEntryForm } from './models-forms';
import { Cpu, Layers, Plus, Trash2 } from 'lucide-react';

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

  const providerOptions = providers.map((p) => ({ id: p.id, name: p.name }));
  const poolModelOptions = models.map((m) => ({
    id: m.id,
    publicModelId: m.publicModelId,
    contextLength: m.contextLength,
  }));

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
      {canWrite && (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/90 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100">
            <Plus className="w-4 h-4 text-neutral-700" />
            <h2 className="text-sm font-heading font-bold text-neutral-950">{t.admin.models.addTitle}</h2>
          </div>
          <AddModelForm providers={providerOptions} />
        </div>
      )}

      {/* Model Table */}
      <ModelsTable
        models={models.map(({ fallbackProviderId: _f, ...m }) => ({ ...m, ready: ready.has(m.id) }))}
        providers={providerOptions}
        canWrite={canWrite}
      />

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
          <AddPoolEntryForm models={poolModelOptions} providers={providerOptions} />
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
