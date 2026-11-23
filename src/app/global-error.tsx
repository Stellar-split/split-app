"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import {
  classifyError,
  getErrorTemplate,
  logError,
} from "@/lib/errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorType = classifyError(error);
  const template = getErrorTemplate(errorType);

  useEffect(() => {
    Sentry.captureException(error);
    logError(error, {
      boundary: "global-error",
      errorType,
      digest: error.digest,
    });
  }, [error, errorType]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#030712" }}>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ textAlign: "center", padding: "2rem", maxWidth: "32rem" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              {template.title}
            </h2>
            <p style={{ color: "#9ca3af", marginBottom: "1.5rem" }}>
              {template.message}
            </p>
            {template.suggestions.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 1.5rem",
                  color: "#9ca3af",
                  fontSize: "0.875rem",
                  textAlign: "left",
                }}
              >
                {template.suggestions.map((suggestion: string) => (
                  <li key={suggestion} style={{ marginBottom: "0.5rem" }}>
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.25rem",
                background: "#4f46e5",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              {template.recoveryLabel}
            </button>
            {error.digest && (
              <p style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "1rem" }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}