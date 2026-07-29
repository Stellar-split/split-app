"use client";

import { useEffect, useMemo, useState } from "react";

const MINUTE_MS = 60_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function formatDisplay(value: Date, now: number) {
  const diffMs = value.getTime() - now;
  const absMs = Math.abs(diffMs);

  if (absMs > WEEK_MS) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  }

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs || unit === "minute") {
      return formatter.format(Math.round(diffMs / unitMs), unit);
    }
  }

  return formatter.format(0, "minute");
}

export default function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const date = useMemo(() => new Date(iso), [iso]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(id);
  }, []);

  if (Number.isNaN(date.getTime())) {
    return <time dateTime={iso}>{iso}</time>;
  }

  const absolute = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);

  return (
    <time dateTime={iso} title={absolute} className={className}>
      {formatDisplay(date, now)}
    </time>
  );
}
