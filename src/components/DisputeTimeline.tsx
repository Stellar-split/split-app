"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { truncateAddress } from "@stellar-split/sdk";

interface DisputeEvent {
  type: "DisputeOpened" | "EvidenceSubmitted" | "VoteCast" | "DisputeResolved";
  timestamp: number;
  actor: string;
  metadata?: {
    reason?: string;
    evidenceCid?: string;
    filename?: string;
    vote?: "Release" | "Refund";
    outcome?: "Release" | "Refund";
  };
}

interface DisputeStatus {
  releaseVotes: number;
  refundVotes: number;
  resolved: boolean;
  outcome?: "Release" | "Refund";
  reason?: string;
  initiator?: string;
}

interface Props {
  invoiceId: string;
  disputeStatus: DisputeStatus;
}

function formatTs(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts * 1000));
}

/**
 * DisputeTimeline — Chronological timeline of all dispute lifecycle events.
 * Shows dispute opening, evidence submissions, arbitrator votes, and resolution.
 */
export default function DisputeTimeline({ invoiceId, disputeStatus }: Props) {
  const [events, setEvents] = useState<DisputeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        // Fetch dispute events from the audit log or contract events
        const log = await (splitClient as any).getDisputeEvents?.(invoiceId);
        if (log && Array.isArray(log)) {
          // Sort events chronologically
          const sorted = log.sort((a: DisputeEvent, b: DisputeEvent) => a.timestamp - b.timestamp);
          setEvents(sorted);
        }
      } catch (err) {
        console.error("Failed to load dispute events:", err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [invoiceId]);

  if (loading) {
    return (
      <section className="mb-8" aria-labelledby="dispute-timeline-heading">
        <h2 id="dispute-timeline-heading" className="text-lg font-semibold mb-4 text-red-400">
          Dispute Timeline
        </h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-700 rounded w-1/3" />
                <div className="h-3 bg-gray-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8" aria-labelledby="dispute-timeline-heading">
      <h2 id="dispute-timeline-heading" className="text-lg font-semibold mb-4 text-red-400">
        Dispute Timeline
      </h2>

      {events.length === 0 ? (
        <p className="text-sm text-gray-500 bg-gray-900/40 border border-gray-700 rounded-lg p-4 text-center">
          No dispute events recorded yet
        </p>
      ) : (
        <ol className="relative border-l-2 border-gray-700 pl-6 space-y-6">
          {events.map((event, idx) => {
            const isLast = idx === events.length - 1;
            const icon = getEventIcon(event.type);
            const color = getEventColor(event.type);

            return (
              <li key={idx} className="relative">
                {/* Timeline marker */}
                <div
                  className={`absolute -left-[1.6rem] top-0 h-8 w-8 rounded-full border-2 flex items-center justify-center text-sm ${color}`}
                  aria-hidden="true"
                >
                  {icon}
                </div>

                {/* Event content */}
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 hover:bg-gray-900/80 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-white text-sm">
                      {getEventTitle(event.type)}
                    </h3>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatTs(event.timestamp)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-400 mb-2">
                    By{" "}
                    <span className="font-mono text-gray-300">
                      {truncateAddress(event.actor)}
                    </span>
                  </p>

                  {/* Event-specific details */}
                  {event.type === "DisputeOpened" && event.metadata?.reason && (
                    <div className="mt-3 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        Reason
                      </p>
                      <p className="text-sm text-gray-300">{event.metadata.reason}</p>
                    </div>
                  )}

                  {event.type === "EvidenceSubmitted" && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-500">📎</span>
                      <span className="text-sm text-gray-300 flex-1 truncate">
                        {event.metadata?.filename || "Evidence file"}
                      </span>
                      {event.metadata?.evidenceCid && (
                        <a
                          href={`https://ipfs.io/ipfs/${event.metadata.evidenceCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          View
                        </a>
                      )}
                    </div>
                  )}

                  {event.type === "VoteCast" && event.metadata?.vote && (
                    <div className="mt-3">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          event.metadata.vote === "Release"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-orange-500/20 text-orange-400"
                        }`}
                      >
                        {event.metadata.vote === "Release" ? "✓ Approve" : "↩️ Refund"}
                      </span>
                    </div>
                  )}

                  {event.type === "DisputeResolved" && (
                    <div className="mt-3 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        Final Outcome
                      </p>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
                            event.metadata?.outcome === "Release"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-orange-500/20 text-orange-400"
                          }`}
                        >
                          {event.metadata?.outcome === "Release"
                            ? "✓ Released"
                            : "↩️ Refunded"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {disputeStatus.releaseVotes} release ·{" "}
                          {disputeStatus.refundVotes} refund
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function getEventIcon(type: DisputeEvent["type"]): string {
  switch (type) {
    case "DisputeOpened":
      return "⚠️";
    case "EvidenceSubmitted":
      return "📎";
    case "VoteCast":
      return "⚖️";
    case "DisputeResolved":
      return "✓";
    default:
      return "•";
  }
}

function getEventColor(type: DisputeEvent["type"]): string {
  switch (type) {
    case "DisputeOpened":
      return "border-red-500 bg-red-500 text-white";
    case "EvidenceSubmitted":
      return "border-blue-500 bg-blue-500 text-white";
    case "VoteCast":
      return "border-indigo-500 bg-indigo-500 text-white";
    case "DisputeResolved":
      return "border-green-500 bg-green-500 text-white";
    default:
      return "border-gray-600 bg-gray-900 text-gray-400";
  }
}

function getEventTitle(type: DisputeEvent["type"]): string {
  switch (type) {
    case "DisputeOpened":
      return "Dispute Opened";
    case "EvidenceSubmitted":
      return "Evidence Submitted";
    case "VoteCast":
      return "Vote Cast";
    case "DisputeResolved":
      return "Dispute Resolved";
    default:
      return "Event";
  }
}
