import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

export async function GET() {
  const started = Date.now();
  try {
    const res = await fetch(`${API_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, latencyMs: Date.now() - started }, { status: 503 });
    }
    return NextResponse.json({ ok: true, latencyMs: Date.now() - started });
  } catch {
    return NextResponse.json({ ok: false, latencyMs: Date.now() - started }, { status: 503 });
  }
}
