"use client";

import { useState } from "react";

export type ReconnectionStatus = "reconnecting" | "reconnected" | "failed";

interface Props {
  show: boolean;
  status: ReconnectionStatus;
  onRetry?: () => void;
  onManualConnect?: () => void;
}

export default function ReconnectionBanner({
  show,
  status,
  onRetry,
  onManualConnect,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  const containerClass =
    status === "reconnected"
      ? "bg-green-700 text-green-100"
      : status === "failed"
        ? "bg-red-700 text-red-100"
        : "bg-yellow-600 text-white animate-pulse";

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-colors ${containerClass}`}
      role="alert"
      aria-live="polite"
    >
      {status === "reconnected" ? (
        <>
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Reconnected</span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-2 text-sm underline hover:no-underline"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </>
      ) : status === "failed" ? (
        <>
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Could not restore wallet connection.</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-2 text-sm font-semibold underline hover:no-underline"
              aria-label="Retry wallet reconnection"
            >
              Retry
            </button>
          )}
          {onManualConnect && (
            <button
              type="button"
              onClick={onManualConnect}
              className="text-sm font-semibold underline hover:no-underline"
              aria-label="Connect wallet manually"
            >
              Connect manually
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-2 text-sm underline hover:no-underline"
            aria-label="Dismiss reconnection banner"
          >
            Dismiss
          </button>
        </>
      ) : (
        <>
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Restoring wallet connection...</span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-2 text-sm underline hover:no-underline"
            aria-label="Dismiss reconnection banner"
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
