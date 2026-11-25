"use client";

import { useMemo, useState } from "react";
import { summarizeEarnings, type EarningRecord } from "@/lib/recipientEarnings";

export default function RecipientEarningsPanel({ records }: { records: EarningRecord[] }) {
  const assets = useMemo(() => Array.from(new Set(records.map((r) => r.asset))), [records]);
  const [asset, setAsset] = useState("all");
  const summary = useMemo(
    () => summarizeEarnings(asset === "all" ? records : records.filter((r) => r.asset === asset)),
    [records, asset],
  );
  const max = Math.max(1, ...summary.byMonth.map((m) => m.total));

  return (
    <section className="space-y-4" aria-label="Recipient earnings">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Earnings</h2>
        <select aria-label="Asset" className="rounded border px-2 py-1" value={asset} onChange={(e) => setAsset(e.target.value)}>
          <option value="all">All assets</option>
          {assets.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Total", summary.total.toFixed(2)],
          ["Payments", String(summary.count)],
          ["Average", summary.average.toFixed(2)],
        ].map(([label, value]) => (
          <div key={label} className="rounded border p-3">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="space-y-1">
        {summary.byMonth.map((m) => (
          <li key={m.month} className="flex items-center gap-2 text-sm">
            <span className="w-16 shrink-0">{m.month}</span>
            <span className="h-2 rounded bg-indigo-500" style={{ width: `${(m.total / max) * 100}%` }} />
            <span className="shrink-0 tabular-nums">{m.total.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
