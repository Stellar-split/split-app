"use client";

import type { Invoice } from "@stellar-split/sdk";

export type StageState = "complete" | "current" | "upcoming" | "skipped";

export interface TimelineStage {
  key: string;
  label: string;
  state: StageState;
  detail?: string;
}

/** Builds the ordered lifecycle stages of an invoice with their current state. */
export function buildStatusStages(invoice: Invoice, nowSec = Math.floor(Date.now() / 1000)): TimelineStage[] {
  const total = invoice.recipients.reduce((sum, r) => sum + r.amount, 0n);
  const hasPayments = invoice.payments.length > 0;
  const fullyFunded = total > 0n && invoice.funded >= total;
  const expired = invoice.deadline <= nowSec;
  const deadline = new Date(invoice.deadline * 1000).toLocaleDateString();
  const settled = invoice.status !== "Pending";

  const stages: TimelineStage[] = [
    { key: "created", label: "Created", state: "complete" },
    {
      key: "funding",
      label: "Funding",
      state: hasPayments ? "complete" : settled ? "skipped" : "current",
      detail: `${invoice.payments.length} payment${invoice.payments.length === 1 ? "" : "s"}`,
    },
    {
      key: "funded",
      label: "Fully Funded",
      state: fullyFunded ? "complete" : settled ? "skipped" : hasPayments ? "current" : "upcoming",
      detail: expired && !fullyFunded ? `Deadline passed ${deadline}` : `Deadline ${deadline}`,
    },
  ];

  if (invoice.status === "Refunded") {
    stages.push({ key: "refunded", label: "Refunded", state: "complete" });
  } else {
    stages.push({
      key: "released",
      label: "Released",
      state: invoice.status === "Released" ? "complete" : fullyFunded ? "current" : "upcoming",
    });
  }
  return stages;
}

const DOT: Record<StageState, string> = {
  complete: "bg-green-500 border-green-500",
  current: "bg-blue-500 border-blue-400 animate-pulse",
  upcoming: "bg-transparent border-gray-500",
  skipped: "bg-gray-600 border-gray-600",
};

export default function AdvancedStatusTimeline({ invoice }: { invoice: Invoice }) {
  const stages = buildStatusStages(invoice);

  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6" aria-labelledby="status-timeline-heading">
      <h2 id="status-timeline-heading" className="text-lg font-semibold text-white mb-4">
        Status Timeline
      </h2>
      <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0">
        {stages.map((stage, i) => (
          <li
            key={stage.key}
            className="flex items-start gap-3 sm:flex-1 sm:flex-col sm:items-center sm:text-center"
            aria-current={stage.state === "current" ? "step" : undefined}
            data-state={stage.state}
          >
            <div className="flex items-center sm:w-full">
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${DOT[stage.state]}`} aria-hidden="true" />
              {i < stages.length - 1 && <span className="hidden h-0.5 flex-1 bg-gray-600 sm:block" aria-hidden="true" />}
            </div>
            <div className="sm:mt-2">
              <p className={`text-sm font-medium ${stage.state === "upcoming" ? "text-gray-400" : "text-white"}`}>
                {stage.label}
              </p>
              {stage.detail && <p className="text-xs text-gray-400">{stage.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
