'use client';

import { signIn } from '@/lib/auth-client';

export default function Login() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-sm flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">Sign in to Morphic</h1>
        <p className="text-[var(--muted)] text-sm">
          Use your Google account to access the dashboard.
        </p>
        <button
          className="btn btn-primary justify-center"
          onClick={() => signIn.social({ provider: 'google', callbackURL: '/dashboard' })}
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}
