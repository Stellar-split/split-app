"use client";

import Link from "next/link";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[GlobalError]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
        <span className="text-5xl font-bold tracking-tight text-indigo-400">
          StellarSplit
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-gray-400 text-sm">
            An unexpected error occurred. You can try again or return home.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="min-h-11 inline-flex items-center px-6 py-2 rounded-lg border border-gray-600 hover:border-gray-400 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Go Home
          </Link>
        </div>

        {process.env.NODE_ENV === "development" && (
          <details className="w-full text-left">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400">
              Error details (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-gray-900 rounded text-xs text-red-400 overflow-auto max-h-48 whitespace-pre-wrap break-all">
              {error.stack ?? error.message}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
