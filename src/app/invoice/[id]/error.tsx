"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import {
  classifyError,
  getErrorTemplate,
  type ErrorKind,
} from "@/lib/errors";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Route-level error boundary for invoice detail pages. */
export default function InvoiceError({ error, reset }: Props) {
  const [sentryEventId, setSentryEventId] = useState<string | null>(null);
  const [kind] = useState<ErrorKind>(() => classifyError(error) as ErrorKind);

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
    logger.error("Invoice detail page failed to load", {
      scope: "InvoiceError",
      kind,
      digest: error.digest,
      error,
    });
  }, [error, kind]);

  const template = getErrorTemplate(kind);

  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-2">{template.title}</h1>
      <p className="text-gray-400 text-sm mb-6">{template.message}</p>
      {template.suggestions.length > 0 && (
        <ul className="text-sm text-gray-400 text-left mb-6 space-y-1 list-disc list-inside">
          {template.suggestions.map((suggestion: string) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
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
          href="/dashboard"
          className="min-h-11 inline-flex items-center px-6 py-3 rounded-lg border border-gray-600 hover:border-gray-400 font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
