"use client";

import { useEffect, useState, useCallback } from "react";

interface CooldownBadgeProps {
  expiresAt: number | null; // unix timestamp in seconds, or null if no cooldown
  onExpired?: () => void;
}

/**
 * Formats a remaining time in seconds into a human-readable countdown string.
 * Returns empty string if remaining <= 0.
 */
function formatCountdown(remainingSec: number): string {
  if (remainingSec <= 0) return "";

  const days = Math.floor(remainingSec / 86400);
  const hours = Math.floor((remainingSec % 86400) / 3600);
  const minutes = Math.floor((remainingSec % 3600) / 60);
  const seconds = remainingSec % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * CooldownBadge — displays an animated countdown for payment cooldown.
 *
 * Polishes the pay button state by showing exactly when the user can pay again.
 * Meets WCAG 2.1 AA accessibility standards:
 * - Uses aria-live="polite" for screen reader announcements
 * - Uses aria-label for context
 * - Sufficient color contrast (red-400 on gray-900)
 * - No reliance on color alone (includes text label)
 */
export default function CooldownBadge({ expiresAt, onExpired }: CooldownBadgeProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!expiresAt || expiresAt <= now) return;

    const interval = setInterval(() => {
      const current = Math.floor(Date.now() / 1000);
      setNow(current);

      if (expiresAt <= current) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired, now]);

  const remaining = expiresAt ? Math.max(0, expiresAt - now) : 0;

  if (!expiresAt || remaining <= 0) return null;

  const countdownText = formatCountdown(remaining);

  return (
    <div
      className="flex items-center gap-2 bg-gray-900 border border-red-800 rounded-lg px-3 py-2 text-sm"
      role="status"
      aria-live="polite"
      aria-label={`Payment cooldown active. ${countdownText} remaining.`}
    >
      {/* Animated spinner */}
      <span
        className="inline-block h-4 w-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin shrink-0"
        aria-hidden="true"
      />
      <span className="text-red-400 font-medium">
        Next payment in {countdownText}
      </span>
    </div>
  );
}
