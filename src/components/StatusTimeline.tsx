"use client";

import type { Invoice } from "@stellar-split/sdk";

interface TimelineEvent {
  key: string;
  icon: string;
  label: string;
  timestamp: number | null;
  actor?: string;
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() / 1000) - ts);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function absoluteTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function truncate(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function buildEvents(invoice: Invoice, total: bigint): TimelineEvent[] {
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
}

export default function StatusTimeline({ invoice, total }: Props) {
  const events = buildEvents(invoice, total);

  // ── Mobile: horizontal stepper ─────────────────────────────────────────────
  const STEPS = ["Created", "Partially Funded", "Fully Funded", "Released / Refunded"] as const;

  function getActiveStep(): number {
    if (invoice.status === "Released" || invoice.status === "Refunded") return 3;
    if (total > 0n && invoice.funded >= total) return 2;
    if (invoice.funded > 0n) return 1;
    return 0;
  }

  const active = getActiveStep();

  return (
    <>
      {/* Mobile: compact horizontal stepper */}
      <div className="sm:hidden grid grid-cols-2 gap-y-4 mb-6">
        {STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          const label = i === 3 && invoice.status !== "Pending" ? invoice.status : step;
          return (
            <div key={step} className="flex-1 flex flex-col items-center min-w-0 px-1">
              <div className="flex items-center w-full">
                {i > 0 && <div className={`flex-1 h-0.5 ${done || current ? "bg-indigo-500" : "bg-gray-700"}`} />}
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${done ? "bg-indigo-500 border-indigo-500" : current ? "bg-white border-indigo-400" : "bg-gray-800 border-gray-600"}`} />
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done ? "bg-indigo-500" : "bg-gray-700"}`} />}
              </div>
              <p className={`text-xs mt-1 text-center ${current ? "text-white font-semibold" : done ? "text-indigo-400" : "text-gray-500"}`}>
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
                    <p
                      className="text-xs text-gray-500 mt-0.5 cursor-default"
                      title={absoluteTime(ev.timestamp)}
                    >
                      {relativeTime(ev.timestamp)}
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
