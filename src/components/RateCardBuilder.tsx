"use client";

import { useState } from "react";
import { lineTotal, rateCardTotal, type RateCardItem } from "@/lib/rateCard";

const UNITS: RateCardItem["unit"][] = ["hour", "day", "project", "item"];

const newItem = (): RateCardItem => ({ id: crypto.randomUUID(), service: "", rate: 0, unit: "hour", quantity: 1 });

export default function RateCardBuilder({ onChange }: { onChange?: (items: RateCardItem[]) => void }) {
  const [items, setItems] = useState<RateCardItem[]>([newItem()]);

  const update = (next: RateCardItem[]) => {
    setItems(next);
    onChange?.(next);
  };
  const patch = (id: string, changes: Partial<RateCardItem>) =>
    update(items.map((i) => (i.id === id ? { ...i, ...changes } : i)));

  return (
    <section className="space-y-3" aria-label="Rate card builder">
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center">
          <input
            aria-label="Service"
            className="col-span-2 rounded border px-2 py-1 sm:col-span-1"
            placeholder="Service"
            value={item.service}
            onChange={(e) => patch(item.id, { service: e.target.value })}
          />
          <input
            aria-label="Rate"
            type="number"
            min={0}
            className="rounded border px-2 py-1"
            value={item.rate}
            onChange={(e) => patch(item.id, { rate: Number(e.target.value) })}
          />
          <select
            aria-label="Unit"
            className="rounded border px-2 py-1"
            value={item.unit}
            onChange={(e) => patch(item.id, { unit: e.target.value as RateCardItem["unit"] })}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                per {u}
              </option>
            ))}
          </select>
          <input
            aria-label="Quantity"
            type="number"
            min={0}
            className="rounded border px-2 py-1"
            value={item.quantity}
            onChange={(e) => patch(item.id, { quantity: Number(e.target.value) })}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm tabular-nums">{lineTotal(item).toFixed(2)}</span>
            <button
              type="button"
              aria-label="Remove"
              className="text-sm text-red-600"
              onClick={() => update(items.filter((i) => i.id !== item.id))}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => update([...items, newItem()])}>
          Add service
        </button>
        <strong className="tabular-nums">Total: {rateCardTotal(items).toFixed(2)}</strong>
      </div>
    </section>
  );
}
