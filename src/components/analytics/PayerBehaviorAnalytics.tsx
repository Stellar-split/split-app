"use client";

import { useMemo, useState } from "react";
import { analyzePayers, type PayerPayment, type PayerSegment } from "@/lib/payerBehavior";

const SEGMENT_STYLES: Record<PayerSegment, string> = {
  reliable: "bg-green-100 text-green-800",
  slow: "bg-yellow-100 text-yellow-800",
  "at-risk": "bg-red-100 text-red-800",
};

export default function PayerBehaviorAnalytics({ payments = [] }: { payments?: PayerPayment[] }) {
  const [segment, setSegment] = useState<PayerSegment | "all">("all");
  const payers = useMemo(() => analyzePayers(payments), [payments]);
  const visible = segment === "all" ? payers : payers.filter((p) => p.segment === segment);

  if (payers.length === 0) {
    return <p className="text-sm text-gray-500">No payer activity yet.</p>;
  }

  return (
    <section className="space-y-3" aria-label="Payer behavior analytics">
      <label className="flex items-center gap-2 text-sm">
        Segment
        <select
          aria-label="Segment"
          className="rounded border px-2 py-1"
          value={segment}
          onChange={(e) => setSegment(e.target.value as PayerSegment | "all")}
        >
          <option value="all">All</option>
          <option value="reliable">Reliable</option>
          <option value="slow">Slow</option>
          <option value="at-risk">At risk</option>
        </select>
      </label>
      <ul className="grid gap-2 sm:grid-cols-2">
        {visible.map((p) => (
          <li key={p.payer} className="rounded border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm" title={p.payer}>
                {p.payer}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs ${SEGMENT_STYLES[p.segment]}`}>{p.segment}</span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-gray-500">Paid</dt>
                <dd className="tabular-nums">{p.totalPaid.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">On time</dt>
                <dd className="tabular-nums">{Math.round(p.onTimeRate * 100)}%</dd>
              </div>
              <div>
                <dt className="text-gray-500">Avg delay</dt>
                <dd className="tabular-nums">{p.avgDelayDays.toFixed(1)}d</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
