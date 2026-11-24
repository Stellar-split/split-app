"use client";

import { useEffect, useState } from "react";

export interface CountdownTimerProps {
  /** Unix timestamp (seconds) at which the invoice expires. */
  deadline: number;
  /** Optional class names for the wrapper element. */
  className?: string;
}

const SECOND = 1000;

/**
 * Formats a remaining duration in milliseconds as `Xd Xh Xm Xs`.
 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / SECOND));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Formats a unix timestamp (seconds) as `Expires July 1, 2026 at 15:00 UTC`.
 */
export function formatExpiry(deadline: number): string {
  const date = new Date(deadline * SECOND);
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `Expires ${month} ${day}, ${year} at ${hours}:${minutes} UTC`;
}

/**
 * Live countdown to an invoice deadline, updating every second.
 */
export default function CountdownTimer({ deadline, className }: CountdownTimerProps) {
  const deadlineMs = deadline * SECOND;
  const [remaining, setRemaining] = useState(() => deadlineMs - Date.now());

  useEffect(() => {
    setRemaining(deadlineMs - Date.now());
    const id = setInterval(() => {
      setRemaining(deadlineMs - Date.now());
    }, SECOND);
    return () => clearInterval(id);
  }, [deadlineMs]);

  const expired = remaining <= 0;
  const label = expired ? "Expired" : `${formatRemaining(remaining)} remaining`;

  return (
    <span
      className={className}
      title={formatExpiry(deadline)}
      role="timer"
      aria-live="off"
      aria-label={label}
    >
      {label}
    </span>
  );
}
