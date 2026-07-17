"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { SubscriptionDetailSkeleton } from "@/components/Skeleton";
import SubscriptionCalendarPreview from "@/components/SubscriptionCalendarPreview";
import SubscriptionHistoryTable from "@/components/SubscriptionHistoryTable";
import type { Subscription } from "@/types/subscription";
import {
  loadSubscriptions,
  saveSubscriptions,
  formatFrequency,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  formatSubscriptionForDisplay,
} from "@/lib/subscriptions";

const POLL_INTERVAL_MS = 30_000;

export default function SubscriptionDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stored = loadSubscriptions();
      const sub = stored.find((s) => s.id === id);

      if (!sub) {
        setError("Subscription not found.");
        setLoading(false);
        return;
      }

      // Enrich invoice history with latest on-chain data
      for (const inv of sub.invoiceHistory) {
        try {
          const invoice = await splitClient.getInvoice(inv.invoiceId);
          inv.status = invoice.status;
        } catch {
          // Invoice may not exist on-chain yet
        }
      }

      setSubscription(sub);
      saveSubscriptions(stored);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Poll for real-time status
  useEffect(() => {
    const interval = setInterval(fetchSubscription, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSubscription]);

  const updateSub = (updater: (sub: Subscription) => Subscription) => {
    setSubscription((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      const all = loadSubscriptions();
      const idx = all.findIndex((s) => s.id === id);
      if (idx !== -1) all[idx] = updated;
      saveSubscriptions(all);
      return updated;
    });
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      updateSub(pauseSubscription);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      updateSub(resumeSubscription);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this subscription?")) return;
    setActionLoading(true);
    try {
      updateSub(cancelSubscription);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
        <SubscriptionDetailSkeleton />
      </main>
    );
  }

  if (error || !subscription) {
    return (
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
        <p className="text-red-400">{error ?? "Subscription not found."}</p>
        <Link
          href="/subscriptions"
          className="text-sm text-indigo-400 hover:text-indigo-300 mt-4 inline-block"
        >
          Back to Subscriptions
        </Link>
      </main>
    );
  }

  const display = formatSubscriptionForDisplay(subscription);

  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/subscriptions"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            ← Subscriptions
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{display.templateName}</h1>
        <span
          className={`text-sm font-medium px-3 py-1 rounded-full border ${
            subscription.status === "active"
              ? "bg-green-500/20 text-green-400 border-green-500/30"
              : subscription.status === "paused"
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30"
          }`}
        >
          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
        </span>
      </div>

      {/* Subscription Config */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Subscription Configuration
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Template Name</p>
            <p className="text-gray-200">{display.templateName}</p>
          </div>
          <div>
            <p className="text-gray-500">Frequency</p>
            <p className="text-gray-200">{formatFrequency(subscription.frequency)}</p>
          </div>
          <div>
            <p className="text-gray-500">Interval</p>
            <p className="text-gray-200">{subscription.intervalDays} days</p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p className="text-gray-200">{display.createdAtFormatted}</p>
          </div>
          <div>
            <p className="text-gray-500">Next Run</p>
            <p className="text-gray-200">
              {subscription.status === "active"
                ? display.nextRunDateFormatted
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Total Invoices</p>
            <p className="text-gray-200">{subscription.totalInvoicesGenerated}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-gray-500">Total USDC Collected</p>
            <p className="text-gray-200 text-lg font-semibold">
              {display.totalUsdcFormatted} USDC
            </p>
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Recipients</h2>
        <div className="space-y-2">
          {subscription.recipients.map((r) => (
            <div key={r.address} className="flex justify-between text-sm">
              <span className="text-gray-400 font-mono text-xs truncate max-w-[60%]">
                {r.address}
              </span>
              <span className="text-gray-300">
                {Number(r.amount) / 1_000_000} USDC
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {subscription.status === "active" && (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Processing..." : "Pause Subscription"}
            </button>
          )}
          {subscription.status === "paused" && (
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Processing..." : "Resume Subscription"}
            </button>
          )}
          {subscription.status !== "cancelled" && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Processing..." : "Cancel Subscription"}
            </button>
          )}
        </div>
      </div>

      {/* Calendar Preview */}
      {subscription.status === "active" && (
        <div className="mb-6">
          <SubscriptionCalendarPreview
            intervalDays={subscription.intervalDays}
            count={6}
          />
        </div>
      )}

      {/* Invoice History */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          Invoice History ({subscription.invoiceHistory.length})
        </h2>
        <SubscriptionHistoryTable history={subscription.invoiceHistory} />
      </div>
    </main>
  );
}
