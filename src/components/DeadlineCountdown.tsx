"use client";

import { useEffect, useState } from "react";
import { isExpired } from "@stellar-split/sdk";
import RelativeTime from "@/components/ui/RelativeTime";

interface Props {
  deadline: number; // unix seconds
  compact?: boolean; // true → compact human-readable countdown, false → full human-readable countdown
  expiredLabel?: string; // label shown once the deadline has passed
}

function calcTimeLeft(deadline: number) {
  return Math.max(0, deadline - Math.floor(Date.now() / 1000));
}

function formatDeadlineTooltip(deadline: number) {
  const date = new Date(deadline * 1000);
  const month = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `Expires ${month} ${day}, ${year} at ${hours}:${minutes} UTC`;
}

function getColorClass(timeLeft: number) {
  if (timeLeft < 3600) return "text-red-500";
  if (timeLeft < 86400) return "text-yellow-500";
  return "text-emerald-500";
}

export default function DeadlineCountdown({ deadline, compact = false, expiredLabel = "Expired" }: Props) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(deadline));
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (isExpired(deadline) || prefersReducedMotion) return;

    const id = window.setInterval(() => {
      const left = calcTimeLeft(deadline);
      setTimeLeft(left);
      if (left === 0) window.clearInterval(id);
    }, 1000);

    return () => window.clearInterval(id);
  }, [deadline, prefersReducedMotion]);

  if (isExpired(deadline) || timeLeft === 0) {
    return (
      <time
        dateTime={new Date(deadline * 1000).toISOString()}
        className="text-red-500 font-mono text-xs font-semibold"
        title={formatDeadlineTooltip(deadline)}
      >
        {expiredLabel}
      </time>
    );
  }

  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const parts = [
    `${days}d`,
    `${hours}h`,
    `${minutes}m`,
    ...(compact ? [] : [`${seconds}s`]),
  ];
  const display = `${parts.join(" ")} remaining`;
  const colorClass = getColorClass(timeLeft);

  return compact ? (
    <RelativeTime
      iso={new Date(deadline * 1000).toISOString()}
      className={`font-mono text-xs font-semibold tabular-nums ${colorClass}`}
    />
  ) : (
    <span
      className={`font-mono text-xs font-semibold tabular-nums ${colorClass}`}
      title={formatDeadlineTooltip(deadline)}
    >
      {display}
    </span>
  );
}
