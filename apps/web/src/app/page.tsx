import Link from 'next/link';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-[var(--border)]">
        <span className="font-bold text-lg">Morphic</span>
        <div className="flex gap-3">
          {session ? (
            <Link href="/dashboard" className="btn btn-primary">Dashboard</Link>
          ) : (
            <Link href="/login" className="btn btn-primary">Sign in</Link>
          )}
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-6">
        <h1 className="text-4xl md:text-6xl font-bold max-w-3xl">
          One API for every AI model
        </h1>
        <p className="text-[var(--muted)] max-w-xl text-lg">
          Access DeepSeek, Qwen, Kimi and more through a single OpenAI-compatible
          endpoint. Unified credits. Simple QR payment. Built for coding agents.
        </p>
        <div className="card font-mono text-sm text-left w-full max-w-lg">
          <div><span className="text-[var(--muted)]">Base URL:</span> https://api.morphic.xxx/v1</div>
          <div><span className="text-[var(--muted)]">API Key:</span> mp-xxxxxxxx</div>
          <div><span className="text-[var(--muted)]">Model:</span> deepseek-v4</div>
        </div>
        <Link href={session ? '/dashboard' : '/login'} className="btn btn-primary text-base">
          {session ? 'Go to Dashboard' : 'Get Started'}
        </Link>
      </section>
    </main>
  );
}
