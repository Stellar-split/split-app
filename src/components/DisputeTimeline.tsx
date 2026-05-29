"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";

interface AuditLogEntry {
  action: string;
  actor: string;
  timestamp: number;
}

interface DisputeStatus {
  forCount: number;
  againstCount: number;
  resolved: boolean;
}

interface Props {
  invoiceId: string;
  disputeStatus: DisputeStatus;
}

const STEPS = [
  { key: "dispute_filed",    label: "Filed" },
  { key: "arbiter_assigned", label: "Arbiter Assigned" },
  { key: "vote_cast",        label: "Votes Cast" },
  { key: "dispute_resolved", label: "Resolved" },
] as const;

function formatTs(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(ts * 1000));
}

export default function DisputeTimeline({ invoiceId, disputeStatus }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    (splitClient as any)
      .getAuditLog(invoiceId)
      .then((log: AuditLogEntry[]) => {
        const keys = new Set<string>(STEPS.map((s) => s.key));
        setEntries((log ?? []).filter((e) => keys.has(e.action)));
      })
      .catch(() => null);
  }, [invoiceId]);

  // Map each step key to the latest matching entry
  const byKey = new Map<string, AuditLogEntry>();
  for (const e of entries) {
    if (!byKey.has(e.action)) byKey.set(e.action, e);
  }

  // Current step index: last step that has a matching entry
  const completedKeys = STEPS.map((s) => s.key).filter((k) => byKey.has(k));
  const currentIdx = completedKeys.length - 1;

  return (
    <section className="mb-8" aria-labelledby="dispute-timeline-heading">
      <h2 id="dispute-timeline-heading" className="text-lg font-semibold mb-4 text-yellow-400">
        Dispute Timeline
      </h2>

      <ol className="relative flex flex-col gap-0">
        {STEPS.map((step, idx) => {
          const entry = byKey.get(step.key);
          const isCompleted = !!entry;
          const isCurrent = idx === currentIdx + 1 && !isCompleted;
          const isResolved = step.key === "dispute_resolved";

          return (
            <li key={step.key} className="flex gap-4 pb-6 last:pb-0">
              {/* Marker + connector */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    isCompleted
                      ? "border-green-500 bg-green-500 text-white"
                      : isCurrent
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                      : "border-gray-600 bg-gray-900 text-gray-600"
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`mt-1 w-0.5 flex-1 ${
                      isCompleted ? "bg-green-500" : "bg-gray-700"
                    }`}
                    style={{ minHeight: "1.5rem" }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="pt-1 pb-2 min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    isCompleted
                      ? "text-white"
                      : isCurrent
                      ? "text-yellow-400"
                      : "text-gray-500"
                  }`}
                >
                  {step.label}
                </p>
                {entry && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatTs(entry.timestamp)}
                  </p>
                )}
                {isResolved && isCompleted && (
                  <p className="text-xs mt-1 font-medium text-gray-300">
                    👍 {disputeStatus.forCount} for · 👎 {disputeStatus.againstCount} against
                    {disputeStatus.resolved && (
                      <span className="ml-2 text-green-400">· Resolved</span>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
