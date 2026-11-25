"use client";

import { useState } from "react";
import {
  INVOICE_RESOURCES,
  RESOURCE_CATEGORIES,
  filterResources,
  type InvoiceResource,
  type ResourceCategory,
} from "@/lib/invoiceResources";

export default function InvoiceEducationalResources({
  resources = INVOICE_RESOURCES,
}: {
  resources?: InvoiceResource[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ResourceCategory | "all">("all");
  const visible = filterResources(resources, { query, category });

  return (
    <section className="space-y-4" aria-label="Invoice educational resources">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Search resources"
          type="search"
          className="w-full rounded border px-3 py-2 sm:flex-1"
          placeholder="Search resources"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Category"
          className="rounded border px-3 py-2"
          value={category}
          onChange={(e) => setCategory(e.target.value as ResourceCategory | "all")}
        >
          <option value="all">All categories</option>
          {RESOURCE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p role="status" className="text-sm text-gray-500">
          No resources match your search.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id} className="rounded border p-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-gray-500">{r.minutes} min read</span>
                </summary>
                <p className="mt-2 text-sm text-gray-500">{r.summary}</p>
                {r.body.map((p, i) => (
                  <p key={i} className="mt-2 text-sm">
                    {p}
                  </p>
                ))}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
