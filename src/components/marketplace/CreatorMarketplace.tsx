"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  discoverCreators,
  listCategories,
  type CreatorSort,
  type MarketplaceCreator,
} from "@/lib/creatorMarketplace";

interface Props {
  creators: MarketplaceCreator[];
}

export default function CreatorMarketplace({ creators }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<CreatorSort>("rating");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const categories = useMemo(() => listCategories(creators), [creators]);
  const results = useMemo(
    () => discoverCreators(creators, { query, category, sort, verifiedOnly }),
    [creators, query, category, sort, verifiedOnly],
  );

  return (
    <section aria-label="Creator marketplace" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          aria-label="Search creators"
          placeholder="Search by name or tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value as CreatorSort)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="rating">Top rated</option>
          <option value="popular">Most popular</option>
          <option value="name">Name</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
          Verified only
        </label>
      </div>

      {results.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No creators found.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((c) => (
            <li key={c.address} className="rounded-lg border border-gray-200 p-4">
              <Link href={`/creator/${c.address}`} className="font-semibold hover:underline">
                {c.name}
              </Link>
              {c.verified && <span className="ml-2 text-xs text-green-600">✓ Verified</span>}
              <p className="text-xs text-gray-500">{c.category}</p>
              <p className="mt-2 text-sm">
                ★ {c.rating.toFixed(1)} · {c.completedInvoices} invoices
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                    {t}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
