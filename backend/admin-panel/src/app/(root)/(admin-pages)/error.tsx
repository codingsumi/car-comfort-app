'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface AdminPageErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Keeps a failed route load actionable while a deployment is being replaced. */
export default function AdminPageError({ error, reset }: AdminPageErrorProps) {
  useEffect(() => {
    console.error('Admin route failed to load', error);
  }, [error]);

  const reloadPage = () => {
    window.location.reload();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary-50 px-6">
      <section className="w-full max-w-md rounded-2xl border border-secondary-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-secondary-900">This page could not load</h1>
        <p className="mt-3 text-sm leading-6 text-secondary-600">
          The admin panel may have just been updated. Reload the page to get the latest version.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reloadPage}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-secondary-300 px-4 py-2 text-sm font-medium text-secondary-700 transition hover:bg-secondary-50"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-secondary-300 px-4 py-2 text-sm font-medium text-secondary-700 transition hover:bg-secondary-50"
          >
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
