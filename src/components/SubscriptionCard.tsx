"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Subscription } from "@/types/subscription";
import {
  formatFrequency,
  formatSubscriptionForDisplay,
} from "@/lib/subscriptions";

/**
 * Returns a human-readable relative time string for a Unix timestamp.
 * - Overdue  → "Overdue by X days"  (red)
 * - < 24 h   → "in X hours"
 * - Otherwise → "in X days" / "Tomorrow" / "Today"
 */
function useRelativeBillingDate(nextRunDate: number): { label: string; overdue: boolean } {
  return useMemo(() => {
    const now = Date.now();
    const target = nextRunDate * 1000;
    const diffMs = target - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffMs < 0) {
      const overdueDays = Math.abs(Math.ceil(diffDays));
      return { label: `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`, overdue: true };
    }

    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

    if (diffHours < 24) {
      const hours = Math.ceil(diffHours);
      return { label: formatter.format(hours, "hour"), overdue: false };
    }

    const days = Math.ceil(diffDays);
    return { label: formatter.format(days, "day"), overdue: false };
  }, [nextRunDate]);
}

interface Props {
  subscription: Subscription;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function SubscriptionCard({ subscription }: Props) {
  const display = formatSubscriptionForDisplay(subscription);
  const { label: relativeLabel, overdue } = useRelativeBillingDate(subscription.nextRunDate);

  return (
    <Link
      href={`/subscriptions/${subscription.id}`}
      className="block bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors"
      aria-label={`Subscription: ${display.templateName}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-100 truncate">
          {display.templateName}
        </h3>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[subscription.status]}`}
        >
          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        {formatFrequency(subscription.frequency)}
      </p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Next Run</p>
          {subscription.status === "active" ? (
            <p className="text-gray-300">
              {display.nextRunDateFormatted}
              <span
                className={`ml-1.5 text-xs ${overdue ? "text-red-400 font-medium" : "text-gray-500"}`}
              >
                · {relativeLabel}
              </span>
            </p>
          ) : (
            <p className="text-gray-300">—</p>
          )}
        </div>
        <div>
          <p className="text-gray-500 text-xs">Invoices</p>
          <p className="text-gray-300">{subscription.totalInvoicesGenerated}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">USDC Collected</p>
          <p className="text-gray-300">{display.totalUsdcFormatted}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Created</p>
          <p className="text-gray-300">{display.createdAtFormatted}</p>
        </div>
      </div>
    </Link>
  );
}
