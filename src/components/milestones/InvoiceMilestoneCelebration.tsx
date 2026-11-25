"use client";

import { useState } from "react";
import { fundedPercent, milestonesFor, newestMilestone } from "@/lib/invoiceMilestones";

export default function InvoiceMilestoneCelebration({ raised, target }: { raised: number; target: number }) {
  const [dismissed, setDismissed] = useState<number | null>(null);
  const milestone = newestMilestone(raised, target);
  const showBanner = milestone !== null && dismissed !== milestone.percent;

  return (
    <section className="space-y-3" aria-label="Invoice milestones">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fundedPercent(raised, target))}
        className="h-2 w-full overflow-hidden rounded bg-gray-200"
      >
        <div className="h-full bg-green-500 transition-all motion-reduce:transition-none" style={{ width: `${fundedPercent(raised, target)}%` }} />
      </div>
      <ol className="flex flex-wrap gap-2 text-xs">
        {milestonesFor(raised, target).map((m) => (
          <li key={m.percent} className={`rounded px-2 py-1 ${m.reached ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
            {m.label}
          </li>
        ))}
      </ol>
      {showBanner && milestone && (
        <div role="status" className="flex items-center justify-between gap-3 rounded border border-green-300 bg-green-50 p-3 text-sm">
          <span>
            <span aria-hidden="true">🎉 </span>
            Milestone reached: {milestone.label}!
          </span>
          <button type="button" className="text-xs underline" onClick={() => setDismissed(milestone.percent)}>
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}
