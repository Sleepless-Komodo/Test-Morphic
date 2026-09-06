import { eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireUser } from '@/lib/actions';
import { formatCredits } from '@/lib/utils';

export default async function ModelsPage() {
  await requireUser();
  const models = await db
    .select({
      publicModelId: s.models.publicModelId,
      displayName: s.models.displayName,
      description: s.models.description,
      contextLength: s.models.contextLength,
      capabilities: s.models.capabilities,
      inputCreditsPer1m: s.models.inputCreditsPer1m,
      outputCreditsPer1m: s.models.outputCreditsPer1m,
      providerName: s.providers.name,
    })
    .from(s.models)
    .innerJoin(s.providers, eq(s.models.providerId, s.providers.id))
    .where(eq(s.models.status, 'active'));

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Models</h1>
      <p className="text-sm text-[var(--muted)]">
        Use the model id in your API requests — Morphic resolves the upstream provider automatically.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((m) => (
          <div key={m.publicModelId} className="card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{m.displayName}</div>
              <span className="badge badge-active">Available</span>
            </div>
            <code className="text-xs text-[var(--accent)] font-mono">{m.publicModelId}</code>
            <div className="text-sm text-[var(--muted)]">{m.description}</div>
            <div className="flex gap-1 flex-wrap">
              {m.capabilities.map((cap) => (
                <span key={cap} className="badge capitalize">{cap.replace('-', ' ')}</span>
              ))}
            </div>
            <div className="text-xs text-[var(--muted)] mt-auto pt-2 border-t border-[var(--border)]">
              {formatCredits(m.contextLength)} context · in {formatCredits(m.inputCreditsPer1m)} / out{' '}
              {formatCredits(m.outputCreditsPer1m)} credits per 1M tokens
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="text-sm font-medium mb-2">Quick start (cURL)</div>
        <pre className="text-xs overflow-x-auto text-[var(--muted)] font-mono">{`curl https://api.morphic.xxx/v1/chat/completions \\
  -H "Authorization: Bearer mp-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${models[0]?.publicModelId ?? 'deepseek-v4'}", "messages": [{"role": "user", "content": "Hello"}]}'`}</pre>
      </div>
    </div>
  );
}
