"use client";

import { useMemo } from "react";
import { buildSocialProof, summarizeSocialProof, type RecentPayment } from "@/lib/socialProof";

interface Props {
  payments: RecentPayment[];
  limit?: number;
  /** Overridable for deterministic rendering. */
  now?: number;
}

export default function SocialProofWidget({ payments, limit = 5, now }: Props) {
  const { items, summary } = useMemo(() => {
    const at = now ?? Date.now();
    return { items: buildSocialProof(payments, at, limit), summary: summarizeSocialProof(payments, at) };
  }, [payments, limit, now]);

  if (items.length === 0) return null;

  return (
    <section aria-label="Recent payments" className="w-full max-w-sm rounded-lg border border-gray-200 p-3">
      {summary.count > 0 && (
        <p className="text-sm font-medium">
          {summary.uniquePayers} {summary.uniquePayers === 1 ? "person" : "people"} paid in the last 24 hours
        </p>
      )}
      <ul aria-live="polite" className="mt-2 space-y-1 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-2">
            <span className="truncate text-gray-700">
              <span className="font-mono">{i.payerLabel}</span> paid {i.amountLabel}
            </span>
            <span className="text-xs text-gray-500">{i.timeAgo}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
