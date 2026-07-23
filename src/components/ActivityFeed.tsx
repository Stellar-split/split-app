"use client";

import { useMemo, useRef } from "react";
import { formatAmount, truncateAddress, type Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  previousInvoice: Invoice | null;
}

type EventType = "payment" | "status";

interface FeedEvent {
  id: string;
  type: EventType;
  label: string;
  address?: string;
  amount?: bigint;
  timestamp: number;
  statusVariant?: "funded" | "released" | "refunded" | "transition";
}

function paymentKey(payer: string, amount: bigint): string {
  return `${payer}:${amount.toString()}`;
}

function relativeTimeAgo(timestamp: number): string {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stamp(map: Map<string, number>, key: string): number {
  if (!map.has(key)) {
    map.set(key, Date.now());
  }
  return map.get(key)!;
}

function deriveEvents(
  invoice: Invoice,
  previousInvoice: Invoice | null,
  timestamps: Map<string, number>
): FeedEvent[] {
  const events: FeedEvent[] = [];
  const total = invoice.recipients.reduce((s, r) => s + r.amount, 0n);

  if (previousInvoice) {
    if (
      previousInvoice.funded < total &&
      invoice.funded >= total &&
      total > 0n &&
      invoice.status === "Pending"
    ) {
      const key = `funded:${invoice.id}`;
      events.push({
        id: key,
        type: "status",
        label: "Fully funded",
        statusVariant: "funded",
        timestamp: stamp(timestamps, key),
      });
    }

    if (previousInvoice.status !== invoice.status) {
      const key = `status:${previousInvoice.status}->${invoice.status}`;
      let statusVariant: FeedEvent["statusVariant"] = "transition";
      if (invoice.status === "Released") statusVariant = "released";
      else if (invoice.status === "Refunded") statusVariant = "refunded";

      events.push({
        id: key,
        type: "status",
        label: `${previousInvoice.status} → ${invoice.status}`,
        statusVariant,
        timestamp: stamp(timestamps, key),
      });
    }
  }

  const prevPayments = new Set(
    (previousInvoice?.payments ?? []).map((p) => paymentKey(p.payer, p.amount))
  );

  for (const payment of invoice.payments) {
    const key = paymentKey(payment.payer, payment.amount);
    if (!previousInvoice || !prevPayments.has(key)) {
      events.push({
        id: `payment:${key}`,
        type: "payment",
        label: "Payment received",
        address: payment.payer,
        amount: payment.amount,
        timestamp: stamp(timestamps, `payment:${key}`),
      });
    }
  }

  return events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);
}

export default function ActivityFeed({ invoice, previousInvoice }: Props) {
  const timestampsRef = useRef(new Map<string, number>());

  const events = useMemo(
    () => deriveEvents(invoice, previousInvoice, timestampsRef.current),
    [invoice, previousInvoice]
  );

  if (events.length === 0) {
    return (
      <section aria-labelledby="activity-heading" className="mb-8">
        <h2 id="activity-heading" className="text-lg font-semibold mb-3">
          Activity
        </h2>
        <p className="text-sm text-gray-400">No activity yet.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="activity-heading" className="mb-8 min-w-0">
      <h2 id="activity-heading" className="text-lg font-semibold mb-3">
        Activity
      </h2>
      <ul className="max-h-64 overflow-y-auto flex flex-col gap-2 pr-1">
        {events.map((event) => (
          <li
            key={event.id}
            className={`rounded-lg px-4 py-3 text-sm min-w-0 ${
              event.type === "status"
                ? event.statusVariant === "released"
                  ? "bg-green-950 border border-green-800"
                  : event.statusVariant === "refunded"
                    ? "bg-gray-900 border border-gray-600"
                    : event.statusVariant === "funded"
                      ? "bg-indigo-950 border border-indigo-800"
                      : "bg-yellow-950 border border-yellow-800"
                : "bg-gray-900"
            }`}
          >
            <div className="flex justify-between gap-2 min-w-0">
              <span className="font-medium text-gray-200 shrink-0">{event.label}</span>
              <span className="text-xs text-gray-500 shrink-0">
                {relativeTimeAgo(event.timestamp)}
              </span>
            </div>
            {event.type === "payment" && event.address && event.amount !== undefined && (
              <p className="text-xs text-gray-400 mt-1 truncate">
                <span className="font-mono">{truncateAddress(event.address)}</span>
                {" · "}
                {formatAmount(event.amount)} USDC
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
