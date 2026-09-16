import { eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { saveModel } from '@/lib/admin-actions';
import { ModelsTable } from './models-table';

/** Inline tooltip — pure CSS, no JS, no extra deps */
function Tip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 cursor-help">
      <span className="w-3.5 h-3.5 rounded-full bg-neutral-300 text-neutral-600 text-[9px] font-bold flex items-center justify-center leading-none select-none">
        ?
      </span>
      <span className="
        pointer-events-none absolute z-50 left-5 top-1/2 -translate-y-1/2
        w-56 px-3 py-2 rounded-lg
        bg-neutral-900 text-white text-[11px] leading-relaxed
        opacity-0 group-hover:opacity-100
        transition-opacity duration-150
        shadow-xl
      ">
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
    <div className={`flex flex-col gap-1 ${span ?? ''}`}>
      <label className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
        {tip && <Tip text={tip} />}
      </label>
      {children}
    </div>
  );
}

export default async function AdminModels() {
  await requireAdmin();
  const [models, providers] = await Promise.all([
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
        status: s.models.status,
        providerName: s.providers.name,
      })
      .from(s.models)
      .innerJoin(s.providers, eq(s.models.providerId, s.providers.id)),
    db.select().from(s.providers),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Models</h1>

      <div className="card">
        <div className="text-sm font-medium mb-4">Add Model</div>
        <form action={saveModel} className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-4">

          {/* Row 1 */}
          <Field
            label="Provider"
            tip="Upstream provider that serves this model. Must be registered in the Providers table first."
          >
            <select name="providerId" className="input" required>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Public Model ID"
            tip="The model ID that external clients (API keys) send in their requests, e.g. deepseek-v4. This is what users put in their OpenAI-compatible SDK config."
          >
            <input
              name="publicModelId"
              className="input font-mono"
              placeholder="deepseek-v4"
              required
            />
          </Field>

          <Field
            label="Provider Model ID"
            tip="The actual model ID forwarded to the upstream provider's API, e.g. deepseek-chat. Check the provider's documentation for the exact value."
          >
            <input
              name="providerModelId"
              className="input font-mono"
              placeholder="deepseek-chat"
              required
            />
          </Field>

          <Field
            label="Display Name"
            tip="Human-readable name shown in the dashboard UI and model picker, e.g. DeepSeek V4 Coder."
          >
            <input
              name="displayName"
              className="input"
              placeholder="DeepSeek V4"
              required
            />
          </Field>

          {/* Row 2 */}
          <Field
            label="Description"
            tip="Short description of what this model is good for. Shown on the developer gateway model cards."
            span="col-span-2"
          >
            <input
              name="description"
              className="input"
              placeholder="Fast and affordable coding model by DeepSeek"
            />
          </Field>

          <Field
            label="Capabilities"
            tip="Comma-separated tags that describe model capabilities. Accepted values: coding, reasoning, chat, multimodal, vision. Used for filtering on the gateway UI."
            span="col-span-2"
          >
            <input
              name="capabilities"
              className="input font-mono"
              placeholder="coding, reasoning"
            />
          </Field>

          {/* Row 3 */}
          <Field
            label="Context Length (tokens)"
            tip="Maximum context window in tokens. Used to display context size on model cards and determine 'Long Context' capability badge (≥128K = Long Context)."
          >
            <input
              name="contextLength"
              className="input"
              type="number"
              placeholder="65536"
              min={1024}
              step={1024}
              required
            />
          </Field>

          <Field
            label="Input Credits / 1M tokens"
            tip="Credits charged per 1 million input (prompt) tokens. Directly maps to how much a user is billed for sending messages. Example: 100 = Rp 100 per 1M tokens."
          >
            <input
              name="inputCreditsPer1m"
              className="input"
              type="number"
              placeholder="100"
              min={1}
              required
            />
          </Field>

          <Field
            label="Output Credits / 1M tokens"
            tip="Credits charged per 1 million output (completion) tokens. Usually higher than input rate since generation is more expensive. Example: 300 = Rp 300 per 1M tokens."
          >
            <input
              name="outputCreditsPer1m"
              className="input"
              type="number"
              placeholder="300"
              min={1}
              required
            />
          </Field>

          <div className="flex items-end">
            <button className="btn btn-primary w-full">Create Model</button>
          </div>
        </form>
      </div>

      {/* Model Table */}
      <div className="card">
        <ModelsTable models={models} providers={providers} />
      </div>
    </div>
  );
}
