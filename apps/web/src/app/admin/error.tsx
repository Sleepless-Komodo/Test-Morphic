'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { getAdminStepUpStatus } from '@/lib/actions';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // Production hides server error messages, so an action refused for a lapsed admin OTP lands
  // here as a generic error. Ask the server and send the admin to the OTP dialog when that is why.
  useEffect(() => {
    let cancelled = false;
    getAdminStepUpStatus()
      .then((status) => {
        if (cancelled || !status.required || window.location.pathname.startsWith('/admin/verify')) return;
        const next = window.location.pathname + window.location.search;
        router.replace(`/admin/verify?next=${encodeURIComponent(next)}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  const isDbTimeout = error.message?.includes('ETIMEDOUT') || error.message?.includes('ECONNREFUSED');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-lg w-full">
        <div className="flex items-center justify-center gap-3 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <h2 className="text-xl font-bold text-red-800">
            {isDbTimeout ? 'Database Waking Up…' : 'Something went wrong'}
          </h2>
        </div>

        {isDbTimeout ? (
          <p className="text-sm text-red-700 mb-5 leading-relaxed">
            The database is coming online after an idle period (Neon cold-start).
            This usually takes a few seconds. Please try refreshing the page.
          </p>
        ) : (
          <p className="text-sm text-red-700 mb-5 leading-relaxed">
            An unexpected error occurred loading this admin page.
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn btn-primary text-sm px-5 py-2 rounded-xl"
          >
            {isDbTimeout ? 'Retry' : 'Try again'}
          </button>
          <a
            href="/admin"
            className="btn text-sm px-5 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50"
          >
            Back to Overview
          </a>
        </div>

        {error.digest && (
          <p className="text-[10px] text-neutral-500 mt-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
