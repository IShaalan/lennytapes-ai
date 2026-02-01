"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold text-foreground mb-4">
          Something went wrong
        </h1>
        <p className="text-foreground-secondary mb-6">
          The tape got tangled. Let&apos;s try rewinding.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
