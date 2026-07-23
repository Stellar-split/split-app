"use client";

import { memo, useState } from "react";
import { useInterval } from "@/hooks/useInterval";
import { DeadlineEngine } from "@/lib/cooldown";

interface Props {
  /** Unix timestamp (seconds) when the cooldown expires, or null for no cooldown. */
  expiresAt: number | null;
}

function CooldownBadge({ expiresAt }: Props) {
  const [countdown, setCountdown] = useState(() =>
    expiresAt != null ? DeadlineEngine.getCountdown(expiresAt) : null
  );

  useInterval(
    () => {
      setCountdown(expiresAt != null ? DeadlineEngine.getCountdown(expiresAt) : null);
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
