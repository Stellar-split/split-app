"use client";

import type { Invoice } from "@stellar-split/sdk";
import RelativeTime from "@/components/ui/RelativeTime";

export interface MilestoneRecord {
  id: string;
  title: string;
  conditionMet?: boolean;
  evidenceSubmitted?: boolean;
  released?: boolean;
  releasedAt?: number | null;
  evidenceAt?: number | null;
  conditionMetAt?: number | null;
}

export interface DisputeRecord {
  id: string;
  status: "Open" | "Evidence" | "Resolved" | "Enforced" | string;
  openedAt?: number | null;
  evidenceAt?: number | null;
  resolvedAt?: number | null;
  enforcedAt?: number | null;
}

interface TimelineEvent {
  key: string;
  icon: string;
  label: string;
  timestamp: number | null;
  actor?: string;
}

function truncate(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function buildEvents(
  invoice: Invoice,
  total: bigint,
  milestones: MilestoneRecord[] = [],
  disputes: DisputeRecord[] = [],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Created — use deadline as a proxy anchor; SDK Invoice has no createdAt
  events.push({
    key: "created",
    icon: "📄",
    label: "Invoice Created",
    timestamp: null,
    actor: invoice.creator,
  });

  if (invoice.funded > 0n) {
    events.push({
      key: "first-payment",
      icon: "💳",
      label: "First Payment",
      timestamp: null,
    });
  }

  const milestone = total > 0n ? (total * 50n) / 100n : 0n;
  if (invoice.funded >= milestone && milestone > 0n) {
    events.push({
      key: "milestone",
      icon: "🏁",
      label: "Milestone Reached (50%)",
      timestamp: null,
    });
  }

  if (total > 0n && invoice.funded >= total) {
    events.push({
      key: "fully-funded",
      icon: "✅",
      label: "Fully Funded",
      timestamp: null,
    });
  }

  // Milestone condition events
  for (const m of milestones) {
    if (m.conditionMet) {
      events.push({
        key: `milestone-${m.id}-condition`,
        icon: "🎯",
        label: `Condition Met: ${m.title}`,
        timestamp: m.conditionMetAt ?? null,
      });
    }
    if (m.evidenceSubmitted) {
      events.push({
        key: `milestone-${m.id}-evidence`,
        icon: "📎",
        label: `Evidence Submitted: ${m.title}`,
        timestamp: m.evidenceAt ?? null,
      });
    }
    if (m.released) {
      events.push({
        key: `milestone-${m.id}-released`,
        icon: "🔓",
        label: `Milestone Released: ${m.title}`,
        timestamp: m.releasedAt ?? null,
      });
    }
  }

  // Dispute lifecycle events
  for (const d of disputes) {
    events.push({
      key: `dispute-${d.id}-opened`,
      icon: "⚠️",
      label: "Dispute Opened",
      timestamp: d.openedAt ?? null,
    });
    if (d.evidenceAt != null || d.status === "Evidence" || d.status === "Resolved" || d.status === "Enforced") {
      events.push({
        key: `dispute-${d.id}-evidence`,
        icon: "📑",
        label: "Dispute Evidence Submitted",
        timestamp: d.evidenceAt ?? null,
      });
    }
    if (d.status === "Resolved" || d.status === "Enforced") {
      events.push({
        key: `dispute-${d.id}-resolved`,
        icon: "⚖️",
        label: "Dispute Resolved",
        timestamp: d.resolvedAt ?? null,
      });
    }
    if (d.status === "Enforced") {
      events.push({
        key: `dispute-${d.id}-enforced`,
        icon: "🔒",
        label: "Resolution Enforced",
        timestamp: d.enforcedAt ?? null,
      });
    }
  }

  if (invoice.status === "Released") {
    events.push({
      key: "released",
      icon: "🚀",
      label: "Funds Released",
      timestamp: null,
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (invoice.status === "Pending" && invoice.deadline <= now) {
    events.push({
      key: "expired",
      icon: "⏰",
      label: "Invoice Expired",
      timestamp: invoice.deadline,
    });
  }

  return events;
}

interface Props {
  invoice: Invoice;
  total: bigint;
  milestones?: MilestoneRecord[];
  disputes?: DisputeRecord[];
}

export default function StatusTimeline({ invoice, total, milestones = [], disputes = [] }: Props) {
  const events = buildEvents(invoice, total, milestones, disputes);

  const hasActiveDispute = disputes.some(
    (d) => d.status !== "Resolved" && d.status !== "Enforced",
  );

  // ── Mobile: horizontal stepper ─────────────────────────────────────────────
  const STEPS = ["Created", "Partially Funded", "Funded", "Released / Refunded"] as const;

  function getActiveStep(): number {
    if (hasActiveDispute) return 4;
    if (invoice.status === "Released" || invoice.status === "Refunded") return 3;
    if (total > 0n && invoice.funded >= total) return 2;
    if (invoice.funded > 0n) return 1;
    return 0;
  }

  const active = getActiveStep();
  const steps = hasActiveDispute ? [...STEPS, "Disputed"] : STEPS;

  return (
    <>
      {/* Mobile: compact horizontal stepper */}
      <div className="sm:hidden grid grid-cols-2 gap-y-4 mb-6">
        {steps.map((step, i) => {
          const done = i < active;
          const current = i === active;
          const isDisputed = step === "Disputed";
          const label = i === 3 && invoice.status !== "Pending" ? invoice.status : step;
          return (
            <div key={step} className={`flex-1 flex flex-col items-center min-w-0 px-1${current ? " text-white font-semibold" : ""}`}>
              <div className="flex items-center w-full">
                {i > 0 && <div className={`flex-1 h-0.5 ${done || current ? (isDisputed ? "bg-red-500" : "bg-indigo-500") : "bg-gray-700"}`} />}
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${done ? (isDisputed ? "bg-red-500 border-red-500" : "bg-indigo-500 border-indigo-500") : current ? (isDisputed ? "bg-red-400 border-red-300" : "bg-white border-indigo-400") : "bg-gray-800 border-gray-600"}`} />
                {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${done ? (isDisputed ? "bg-red-500" : "bg-indigo-500") : "bg-gray-700"}`} />}
              </div>
              <p className={`text-xs mt-1 text-center ${current ? (isDisputed ? "text-red-400 font-semibold" : "text-white font-semibold") : done ? (isDisputed ? "text-red-400" : "text-indigo-400") : "text-gray-500"}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Desktop: vertical timeline */}
      <div className="hidden sm:block">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Timeline</h3>

        {events.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No events yet.</p>
        ) : (
          <ol
            className="relative border-l border-gray-700 max-h-72 overflow-y-auto pl-4 space-y-5"
            aria-label="Invoice status timeline"
          >
            {events.map((ev, idx) => (
              <li key={ev.key} className="relative flex gap-3">
                {/* Dot on the timeline line */}
                <span
                  className={`absolute -left-[1.35rem] flex h-6 w-6 items-center justify-center rounded-full text-sm border-2 ${
                    idx === events.length - 1
                      ? "bg-indigo-600 border-indigo-500"
                      : "bg-gray-800 border-gray-600"
                  }`}
                  aria-hidden="true"
                >
                  {ev.icon}
                </span>

                <div className="ml-2 min-w-0">
                  <p className="text-sm font-medium text-gray-200">{ev.label}</p>
                  {ev.actor && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      by <span className="font-mono">{truncate(ev.actor)}</span>
                    </p>
                  )}
                  {ev.timestamp ? (
                    <p className="text-xs text-gray-500 mt-0.5 cursor-default">
                      <RelativeTime iso={new Date(ev.timestamp * 1000).toISOString()} />
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600 mt-0.5 italic">timestamp pending</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
