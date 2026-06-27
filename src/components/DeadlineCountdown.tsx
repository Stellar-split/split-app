"use client";

import { useEffect, useState } from "react";
import { isExpired } from "@stellar-split/sdk";

interface Props {
  deadline: number; // unix seconds
  compact?: boolean; // true → compact human-readable countdown, false → full human-readable countdown
}

function calcTimeLeft(deadline: number) {
  return Math.max(0, deadline - Math.floor(Date.now() / 1000));
}

function formatDeadlineTooltip(deadline: number) {
  const date = new Date(deadline * 1000);
  const datePart = date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `Expires ${datePart} at ${timePart} UTC`;
}

function getColorClass(timeLeft: number) {
  if (timeLeft < 3600) return "text-red-500";
  if (timeLeft < 86400) return "text-yellow-500";
  return "text-emerald-500";
}

export default function DeadlineCountdown({ deadline, compact = false }: Props) {
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
      <span className="text-red-500 font-mono text-xs font-semibold" title={formatDeadlineTooltip(deadline)}>
        Expired
      </span>
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

  return (
    <span
      className={`font-mono text-xs font-semibold tabular-nums ${colorClass}`}
      title={formatDeadlineTooltip(deadline)}
    >
      {display}
    </span>
  );
}
