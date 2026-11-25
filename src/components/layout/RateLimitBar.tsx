"use client";

import { useEffect, useState } from "react";
import { useRateLimit } from "@/context/RateLimitContext";

/**
 * RateLimitBar — a slim dismissable banner that appears at the top of the page
 * whenever an API call returns 429. Shows a live countdown and disappears when
 * the auto-retry resolves.
 *
 * Dismissing hides the visual banner but the auto-retry still proceeds.
 */
export default function RateLimitBar() {
  const { retryAt } = useRateLimit();
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Reset dismissed state each time a new rate-limit is triggered.
  useEffect(() => {
    if (retryAt !== null) {
      setDismissed(false);
      setSecondsLeft(Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000)));
    }
  }, [retryAt]);

  // Tick the countdown every second while active.
  useEffect(() => {
    if (retryAt === null) return;

    const tick = () => {
      const s = Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
      setSecondsLeft(s);
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [retryAt]);

  // Nothing to render when there's no rate-limit or it's been dismissed.
  if (retryAt === null || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="relative z-50 flex items-center justify-between gap-3 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium"
    >
      <span>
        Rate limit reached — retrying automatically in{" "}
        <strong>{secondsLeft}s</strong>
        {secondsLeft === 0 && " (retrying…)"}
      </span>

      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss rate-limit notice"
        className="shrink-0 flex items-center justify-center h-6 w-6 rounded hover:bg-amber-600/20 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1l12 12M13 1 1 13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
