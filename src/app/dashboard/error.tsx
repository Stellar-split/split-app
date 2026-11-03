"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  classifyError,
  getErrorTemplate,
  logError,
} from "@/lib/errors";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Route-level error boundary for the dashboard. */
export default function DashboardError({ error, reset }: Props) {
  const [sentryEventId, setSentryEventId] = useState<string | null>(null);

  const errorType = useMemo(() => classifyError(error), [error]);
  const template = useMemo(() => getErrorTemplate(errorType), [errorType]);

  useEffect(() => {
    const capture = async () => {
      try {
        const Sentry = await import("@sentry/nextjs");
        const id = Sentry.captureException(error);
        setSentryEventId(id);
      } catch {
        // Sentry unavailable
      }
    };
    capture();
    logError(error, { boundary: "DashboardError", errorType });
  }, [error, errorType]);

  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">{template.title}</h1>
      <p className="text-gray-400 text-sm mb-6">{template.message}</p>
      {template.suggestions.length > 0 && (
        <div className="text-left bg-gray-900/60 border border-gray-700 rounded-lg p-4 mb-6">
          <p className="text-sm font-semibold text-gray-200 mb-2">
            What you can try:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            {template.suggestions.map((suggestion: string) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
      {sentryEventId && (
        <p className="text-xs text-gray-500 font-mono mb-4">
          Error ID: {sentryEventId}
        </p>
      )}
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="min-h-11 inline-flex items-center px-6 py-3 rounded-lg border border-gray-600 hover:border-gray-400 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
