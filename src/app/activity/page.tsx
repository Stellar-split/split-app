"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, truncateAddress, type Invoice } from "@stellar-split/sdk";

interface ActivityEvent {
  id: string;
  type: "payment" | "release" | "refund";
  invoiceId: string;
  amount?: bigint;
  payer?: string;
  timestamp: number;
}

function relativeTimeAgo(timestamp: number): string {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivityPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setError("Connect your Freighter wallet to view activity."));
  }, []);

  const fetchActivity = async () => {
    if (!publicKey) return;
    try {
      const allEvents: ActivityEvent[] = [];
      const invoiceMap = new Map<string, Invoice>();

      // Fetch all invoices (creator or recipient)
      for (let id = 1; id <= 50; id++) {
        try {
          const inv = await splitClient.getInvoice(String(id));
          const isCreator = inv.creator === publicKey;
          const isRecipient = inv.recipients.some((r) => r.address === publicKey);
          if (isCreator || isRecipient) {
            invoiceMap.set(inv.id, inv);
          }
        } catch {
          break;
        }
      }

      // Extract events from invoices
      invoiceMap.forEach((inv) => {
        // Payment events
        inv.payments.forEach((payment) => {
          allEvents.push({
            id: `payment:${inv.id}:${payment.payer}:${payment.amount}`,
            type: "payment",
            invoiceId: inv.id,
            amount: payment.amount,
            payer: payment.payer,
            timestamp: Date.now() - Math.random() * 86400000, // Approximate
          });
        });

        // Status events
        if (inv.status === "Released") {
          allEvents.push({
            id: `release:${inv.id}`,
            type: "release",
            invoiceId: inv.id,
            timestamp: Date.now() - Math.random() * 86400000,
          });
        } else if (inv.status === "Refunded") {
          allEvents.push({
            id: `refund:${inv.id}`,
            type: "refund",
            invoiceId: inv.id,
            timestamp: Date.now() - Math.random() * 86400000,
          });
        }
      });

      // Sort by timestamp descending
      allEvents.sort((a, b) => b.timestamp - a.timestamp);
      setEvents(allEvents);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      fetchActivity();
      const pollId = setInterval(() => {
        fetchActivity();
      }, 30000);
      return () => clearInterval(pollId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  if (error) {
    return (
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-20 text-center overflow-x-hidden">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
        <h1 className="text-3xl font-bold mb-8">Activity</h1>
        <p className="text-gray-400">Loading activity…</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <h1 className="text-3xl font-bold mb-8">Activity</h1>

      {events.length === 0 ? (
        <p className="text-gray-400">No activity yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="bg-gray-900 rounded-lg px-4 py-3 text-sm border border-gray-800"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200">
                      {event.type === "payment"
                        ? "Payment received"
                        : event.type === "release"
                          ? "Invoice released"
                          : "Invoice refunded"}
                    </span>
                    <Link
                      href={`/invoice/${event.invoiceId}`}
                      className="text-indigo-400 hover:text-indigo-300 text-xs font-mono"
                    >
                      #{event.invoiceId}
                    </Link>
                  </div>
                  {event.type === "payment" && event.payer && event.amount !== undefined && (
                    <p className="text-xs text-gray-400">
                      <span className="font-mono">{truncateAddress(event.payer)}</span>
                      {" · "}
                      {formatAmount(event.amount)} USDC
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {relativeTimeAgo(event.timestamp)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
