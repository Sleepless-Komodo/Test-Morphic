'use client';

import { useState } from 'react';
import { saveModel } from '@/lib/admin-actions';

interface Provider { id: string; name: string; }
interface ModelRow {
  id: string;
  publicModelId: string;
  providerModelId: string;
  displayName: string;
  description: string | null;
  contextLength: number;
  capabilities: string[];
  inputCreditsPer1m: number;
  outputCreditsPer1m: number;
  status: string;
  providerName: string;
  providerId?: string;
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 cursor-help">
      <span className="w-3.5 h-3.5 rounded-full bg-neutral-300 text-neutral-600 text-[9px] font-bold flex items-center justify-center leading-none select-none">
        ?
      </span>
      <span className="pointer-events-none absolute z-50 left-5 top-1/2 -translate-y-1/2 w-56 px-3 py-2 rounded-lg bg-neutral-900 text-white text-[11px] leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-xl">
        {text}
      </span>
    </span>
  );
}

function Field({ label, tip, children, span }: {
  label: string; tip?: string; children: React.ReactNode; span?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${span ?? ''}`}>
      <label className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}{tip && <Tip text={tip} />}
      </label>
      {children}
    </div>
  );
}

/** Inline edit row that replaces the table row when editing */
function EditRow({ model, providers, onDone }: {
  model: ModelRow;
  providers: Provider[];
  onDone: () => void;
}) {
  return (
    <tr className="bg-amber-50/60 border-y-2 border-amber-300">
      <td colSpan={7} className="px-4 py-4">
        <form
          action={async (fd) => { await saveModel(fd); onDone(); }}
          className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3"
        >
          {/* hidden id — triggers UPDATE in saveModel */}
          <input type="hidden" name="id" value={model.id} />

          <Field label="Provider" tip="Upstream provider serving this model.">
            <select name="providerId" className="input" required defaultValue={model.providerId ?? ''}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Public Model ID" tip="ID that API clients send in requests (e.g. deepseek-v4).">
            <input name="publicModelId" className="input font-mono" defaultValue={model.publicModelId} required />
          </Field>

          <Field label="Provider Model ID" tip="Actual model ID forwarded to the upstream API (e.g. deepseek-chat).">
            <input name="providerModelId" className="input font-mono" defaultValue={model.providerModelId} required />
          </Field>

          <Field label="Display Name" tip="Human-readable name shown in dashboard UI.">
            <input name="displayName" className="input" defaultValue={model.displayName} required />
          </Field>

          <Field label="Description" tip="Short description shown on model cards." span="col-span-2">
            <input name="description" className="input" defaultValue={model.description ?? ''} />
          </Field>

          <Field label="Capabilities" tip="Comma-separated: coding, reasoning, chat, multimodal, vision." span="col-span-2">
            <input name="capabilities" className="input font-mono" defaultValue={model.capabilities.join(', ')} />
          </Field>

          <Field label="Context Length" tip="Max context window in tokens. ≥128K = Long Context badge.">
            <input name="contextLength" className="input" type="number" defaultValue={model.contextLength} min={1024} step={1024} required />
          </Field>

          <Field label="Input Credits / 1M" tip="Credits charged per 1M input (prompt) tokens.">
            <input name="inputCreditsPer1m" className="input" type="number" defaultValue={model.inputCreditsPer1m} min={1} required />
          </Field>

          <Field label="Output Credits / 1M" tip="Credits charged per 1M output (completion) tokens.">
            <input name="outputCreditsPer1m" className="input" type="number" defaultValue={model.outputCreditsPer1m} min={1} required />
          </Field>

          <Field label="Status" tip="active = available to users. inactive = hidden from API. deprecated = sunset.">
            <select name="status" className="input" defaultValue={model.status}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="deprecated">deprecated</option>
            </select>
          </Field>

          <div className="col-span-full flex gap-2 pt-1">
            <button type="submit" className="btn btn-primary">Save Changes</button>
            <button type="button" onClick={onDone} className="btn">Cancel</button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export function ModelsTable({ models, providers }: {
  models: (ModelRow & { providerId: string })[];
  providers: Provider[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <table className="data">
      <thead>
        <tr>
          <th>Public ID</th>
          <th>Provider ID</th>
          <th>Provider</th>
          <th>Context</th>
          <th>In / Out per 1M</th>
          <th>Capabilities</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {models.map((m) =>
          editingId === m.id ? (
            <EditRow
              key={m.id}
              model={m}
              providers={providers}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <tr key={m.id}>
              <td className="font-mono text-xs">{m.publicModelId}</td>
              <td className="font-mono text-xs text-[var(--muted)]">{m.providerModelId}</td>
              <td>{m.providerName}</td>
              <td className="font-mono">{(m.contextLength / 1000).toFixed(0)}K</td>
              <td className="font-mono">{m.inputCreditsPer1m} / {m.outputCreditsPer1m}</td>
              <td className="text-xs text-[var(--muted)]">
                {Array.isArray(m.capabilities) ? m.capabilities.join(', ') : '—'}
              </td>
              <td>
                <span className={m.status === 'active' ? 'badge badge-active' : 'badge'}>
                  {m.status}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => setEditingId(m.id)}
                  className="text-xs px-2.5 py-1 rounded-md border border-neutral-300 hover:border-neutral-500 hover:bg-neutral-100 font-medium transition-colors cursor-pointer"
                >
                  Edit
                </button>
              </td>
            </tr>
          )
        )}
      </tbody>
    </table>
  );
}
