"use client";

import { useMemo, useState } from "react";
import {
  auditEntriesToCsv,
  filterAuditEntries,
  type AuditCategory,
  type AuditEntry,
} from "@/lib/auditLog";

const CATEGORIES: Array<AuditCategory | "all"> = ["all", "invoice", "payment", "auth", "settings", "admin"];

interface Props {
  entries: AuditEntry[];
}

export default function AuditLogViewer({ entries }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const visible = useMemo(() => filterAuditEntries(entries, { query, category }), [entries, query, category]);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([auditEntriesToCsv(visible)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Audit log" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          aria-label="Search audit log"
          placeholder="Search actor, action, target…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value as AuditCategory | "all")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm capitalize"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No audit entries match your filters.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {visible.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
              <time className="shrink-0 text-xs text-gray-500 sm:w-44" dateTime={new Date(e.timestamp).toISOString()}>
                {new Date(e.timestamp).toLocaleString()}
              </time>
              <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">{e.category}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.action}</p>
                {e.details && <p className="text-xs text-gray-600">{e.details}</p>}
              </div>
              <span className="truncate font-mono text-xs text-gray-500 sm:max-w-[10rem]" title={e.actor}>
                {e.actor}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
