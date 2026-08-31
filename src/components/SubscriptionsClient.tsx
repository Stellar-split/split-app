"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { SubscriptionListSkeleton } from "@/components/Skeleton";
import SubscriptionCard from "@/components/SubscriptionCard";
import type { Subscription, SubscriptionStatus } from "@/types/subscription";
import {
  loadSubscriptions,
  saveSubscriptions,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} from "@/lib/subscriptions";

const POLL_INTERVAL_MS = 30_000;

type StatusFilter = "all" | SubscriptionStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

export default function SubscriptionsClient() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() =>
        setError("Connect your Freighter wallet to view subscriptions.")
      );
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      // Load locally-stored subscriptions and enrich with on-chain data
      const stored = loadSubscriptions();
      const creatorSubs = stored.filter((s) => s.creator === publicKey);

      // Enrich each subscription with latest invoice data from chain
      const enriched: Subscription[] = [];
      for (const sub of creatorSubs) {
        try {
          // Check if the associated invoices exist on-chain
          for (const inv of sub.invoiceHistory) {
            try {
              const invoice = await splitClient.getInvoice(inv.invoiceId);
              // Update invoice status from chain
              inv.status = invoice.status;
            } catch {
              // Invoice may not exist on-chain yet
            }
          }
          enriched.push(sub);
        } catch {
          enriched.push(sub);
        }
      }

      setSubscriptions(enriched);
      saveSubscriptions(enriched);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Poll for real-time status updates
  useEffect(() => {
    if (!publicKey) return;
    const interval = setInterval(fetchSubscriptions, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [publicKey, fetchSubscriptions]);

  const handlePause = async (id: string) => {
    setSubscriptions((prev) => {
      const updated = prev.map((s) => (s.id === id ? pauseSubscription(s) : s));
      saveSubscriptions(updated);
      return updated;
    });
  };

  const handleResume = async (id: string) => {
    setSubscriptions((prev) => {
      const updated = prev.map((s) => (s.id === id ? resumeSubscription(s) : s));
      saveSubscriptions(updated);
      return updated;
    });
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this subscription?")) return;
    setSubscriptions((prev) => {
      const updated = prev.map((s) => (s.id === id ? cancelSubscription(s) : s));
      saveSubscriptions(updated);
      return updated;
    });
  };

  if (error) {
    return (
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <Link
          href="/dashboard"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Summary */}
      {!loading && subscriptions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">
              {subscriptions.filter((s) => s.status === "active").length}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Paused</p>
            <p className="text-2xl font-bold text-yellow-400">
              {subscriptions.filter((s) => s.status === "paused").length}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Cancelled</p>
            <p className="text-2xl font-bold text-red-400">
              {subscriptions.filter((s) => s.status === "cancelled").length}
            </p>
          </div>
        </div>
      )}

      {/* Status Filter */}
      {!loading && subscriptions.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === filter.value
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-gray-700 text-gray-300 hover:bg-gray-800"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Subscription List */}
      {loading ? (
        <SubscriptionListSkeleton />
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">
            No subscriptions yet. Create recurring invoices to get started.
          </p>
          <Link
            href="/invoice/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
          >
            Create Invoice
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {subscriptions
            .filter((sub) => statusFilter === "all" || sub.status === statusFilter)
            .map((sub) => (
            <div key={sub.id} className="flex flex-col gap-2">
              <SubscriptionCard subscription={sub} />
              <div className="flex gap-2 px-1">
                {sub.status === "active" && (
                  <button
                    onClick={() => handlePause(sub.id)}
                    className="text-xs px-3 py-1 rounded border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                  >
                    Pause
                  </button>
                )}
                {sub.status === "paused" && (
                  <button
                    onClick={() => handleResume(sub.id)}
                    className="text-xs px-3 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                  >
                    Resume
                  </button>
                )}
                {sub.status !== "cancelled" && (
                  <button
                    onClick={() => handleCancel(sub.id)}
                    className="text-xs px-3 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
