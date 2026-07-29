"use client";

import { useState } from "react";

interface Props {
  show: boolean;
  isConnected: boolean;
}

export default function ReconnectionBanner({ show, isConnected }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-colors ${
        isConnected
          ? "bg-green-700 text-green-100"
          : "bg-yellow-600 text-white animate-pulse"
      }`}
      role="alert"
    >
      {isConnected ? (
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
      ) : (
        <>
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Connection lost — reconnecting...</span>
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
