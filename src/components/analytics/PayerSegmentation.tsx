"use client";

import { useMemo, useState } from "react";
import {
  SEGMENT_DEFINITIONS,
  segmentPayers,
  summarizeSegments,
  type PayerRecord,
  type PayerSegmentId,
} from "@/lib/payerSegmentation";

export default function PayerSegmentation({ payers, now }: { payers: PayerRecord[]; now?: number }) {
  const [selected, setSelected] = useState<PayerSegmentId | "all">("all");
  const segmented = useMemo(() => segmentPayers(payers, now), [payers, now]);
  const summary = useMemo(() => summarizeSegments(segmented), [segmented]);
  const visible = selected === "all" ? segmented : segmented.filter((p) => p.segment === selected);

  if (payers.length === 0) {
    return (
      <p role="status" className="text-sm text-gray-500">
        No payers to segment yet.
      </p>
    );
  }

  return (
    <section className="space-y-4" aria-label="Payer segmentation">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((s) => (
          <button
            key={s.segment}
            type="button"
            aria-pressed={selected === s.segment}
            title={s.description}
            className={`rounded border p-2 text-left ${selected === s.segment ? "border-indigo-500" : ""}`}
            onClick={() => setSelected(selected === s.segment ? "all" : s.segment)}
          >
            <span className="block text-xs text-gray-500">{s.label}</span>
            <span className="block text-lg font-semibold tabular-nums">{s.count}</span>
            <span className="block text-xs tabular-nums text-gray-500">
              {Math.round(s.share * 100)}% · {s.totalPaid.toFixed(2)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="text-sm" htmlFor="payer-segment-filter">
          Segment
        </label>
        <select
          id="payer-segment-filter"
          className="rounded border px-2 py-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value as PayerSegmentId | "all")}
        >
          <option value="all">All segments</option>
          {SEGMENT_DEFINITIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2">
        {visible.map((p) => (
          <li key={p.address} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
            <span className="break-all font-mono">{p.address}</span>
            <span className="flex flex-wrap gap-3 tabular-nums">
              <span data-testid="segment-label">
                {SEGMENT_DEFINITIONS.find((d) => d.id === p.segment)?.label}
              </span>
              <span>{p.paymentCount} payments</span>
              <span>{p.totalPaid.toFixed(2)} paid</span>
              <span>{p.recencyDays}d ago</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
