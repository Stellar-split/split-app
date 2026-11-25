"use client";

import { memo, useEffect, useState } from "react";
import { useInterval } from "@/hooks/useInterval";
import { DeadlineEngine, type Countdown } from "@/lib/cooldown";

interface Props {
  /** Unix timestamp (seconds) when the cooldown expires, or null for no cooldown. */
  expiresAt: number | null;
}

const computeCountdown = (expiresAt: number | null): Countdown | null =>
  expiresAt != null ? DeadlineEngine.getCountdown(expiresAt) : null;

function CooldownBadge({ expiresAt }: Props) {
  const [countdown, setCountdown] = useState<Countdown | null>(() =>
    computeCountdown(expiresAt)
  );

  // Recompute immediately whenever the deadline changes (null -> future,
  // active -> null, or a replaced deadline) instead of waiting for a tick.
  useEffect(() => {
    setCountdown(computeCountdown(expiresAt));
  }, [expiresAt]);

  useInterval(
    () => {
      setCountdown(computeCountdown(expiresAt));
    },
    expiresAt != null && countdown != null ? 1000 : null
  );

  if (!countdown) return null;

  const label = DeadlineEngine.formatCountdown(countdown);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-700/50"
    >
      <span
        className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse"
        aria-hidden="true"
      />
      Next payment in {label}
    </span>
  );
}

export default memo(CooldownBadge);
