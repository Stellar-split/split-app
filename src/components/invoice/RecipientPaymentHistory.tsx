"use client";

import { useEffect, useState } from "react";
import TxHash from "@/components/ui/TxHash";
import RelativeTime from "@/components/ui/RelativeTime";

export interface RecipientHistoryEntry {
  operationHash: string;
  amount: string;
  asset: string;
  timestamp: string;
  from: string;
}

interface RecipientPaymentHistoryProps {
  invoiceId: string;
  recipientId: string;
  /** Network for Stellar transaction explorer links */
  network?: "testnet" | "mainnet";
}

/**
 * RecipientPaymentHistory — displays payment timeline for one recipient on an invoice.
 *
 * Data is fetched lazily on mount from GET /api/invoices/[id]/recipients/[recipientId]/history
 * and cached for the page session (component stays mounted while the row is expanded).
 *
 * Supports cursor-based pagination if the recipient has >20 payments, though that's rare.
 */
export default function RecipientPaymentHistory({
  invoiceId,
  recipientId,
  network = "testnet",
}: RecipientPaymentHistoryProps) {
  const [entries, setEntries] = useState<RecipientHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const url = new URL(
      `/api/invoices/${invoiceId}/recipients/${recipientId}/history`,
      window.location.origin
    );

    fetch(url.toString(), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          return res.json().then(
            (json) => {
              throw new Error(json.error ?? "Failed to load payment history");
            },
            () => {
              throw new Error("Failed to load payment history");
            }
          );
        }
        return res.json();
      })
      .then((data) => {
        setEntries(data.entries ?? []);
        setCursor(data.cursor ?? null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Payment history fetch error:", err);
          setError(err.message ?? "Failed to load payment history");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [invoiceId, recipientId]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    const url = new URL(
      `/api/invoices/${invoiceId}/recipients/${recipientId}/history`,
      window.location.origin
    );
    url.searchParams.set("cursor", cursor);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to load more entries");
      }
      const data = await res.json();
      setEntries((prev) => [...prev, ...(data.entries ?? [])]);
      setCursor(data.cursor ?? null);
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-400 animate-pulse">
        Loading payment history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-400" role="alert">
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="p-4 text-sm text-gray-400 text-center"
        data-testid="empty-history"
      >
        No payments recorded yet
      </div>
    );
  }

  return (
    <div className="border-t border-gray-700 bg-gray-800/50">
      <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Payment History
      </div>

      <div className="divide-y divide-gray-700">
        {entries.map((entry) => (
          <div
            key={entry.operationHash}
            data-testid={`history-entry-${entry.operationHash}`}
            className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-100">
                  {entry.amount} {entry.asset}
                </span>
                <span className="text-xs text-gray-400">
                  from{" "}
                  <code className="bg-gray-700 px-1.5 py-0.5 rounded text-[11px]">
                    {entry.from.slice(0, 8)}...{entry.from.slice(-6)}
                  </code>
                </span>
              </div>

              <div className="text-xs text-gray-500">
                <RelativeTime iso={entry.timestamp} />
              </div>
            </div>

            <div className="shrink-0">
              <TxHash hash={entry.operationHash} network={network} />
            </div>
          </div>
        ))}
      </div>

      {cursor && (
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
