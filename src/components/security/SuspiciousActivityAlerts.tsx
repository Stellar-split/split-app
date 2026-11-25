"use client";

import { useMemo, useState } from "react";
import {
  detectSuspiciousActivity,
  type ActivityEvent,
  type AlertSeverity,
  type DetectionOptions,
} from "@/lib/suspiciousActivity";

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  high: "border-red-300 bg-red-50 text-red-800",
  medium: "border-amber-300 bg-amber-50 text-amber-800",
  low: "border-blue-300 bg-blue-50 text-blue-800",
};

interface Props {
  events: ActivityEvent[];
  options?: DetectionOptions;
}

export default function SuspiciousActivityAlerts({ events, options }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const alerts = useMemo(
    () => detectSuspiciousActivity(events, options).filter((a) => !dismissed.has(a.id)),
    [events, options, dismissed],
  );

  if (alerts.length === 0) {
    return <p className="text-sm text-gray-500">No suspicious activity detected.</p>;
  }

  return (
    <ul aria-label="Suspicious activity alerts" className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          role="alert"
          className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${SEVERITY_STYLES[a.severity]}`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold capitalize">
              {a.severity} risk · {a.rule.replace("_", " ")}
            </p>
            <p className="text-sm">{a.message}</p>
            <p className="truncate font-mono text-xs opacity-75" title={a.actor}>
              {a.actor}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
            className="w-fit rounded-md border border-current px-3 py-1 text-xs"
          >
            Dismiss
          </button>
        </li>
      ))}
    </ul>
  );
}
