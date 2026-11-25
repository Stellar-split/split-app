"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_RESOURCES,
  RESOURCE_CATEGORIES,
  filterResources,
  loadBookmarks,
  saveBookmarks,
  toggleBookmark,
  type CreatorResource,
  type ResourceCategory,
} from "@/lib/creatorResources";

export default function ResourceLibrary({ resources = DEFAULT_RESOURCES }: { resources?: CreatorResource[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ResourceCategory | "all">("all");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  useEffect(() => setBookmarks(loadBookmarks()), []);

  const visible = useMemo(
    () => filterResources(resources, { query, category, bookmarkedOnly }, bookmarks),
    [resources, query, category, bookmarkedOnly, bookmarks],
  );

  const toggle = (id: string) => {
    const next = toggleBookmark(bookmarks, id);
    setBookmarks(next);
    saveBookmarks(next);
  };

  return (
    <section className="space-y-4" aria-label="Resource library">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <input
          type="search"
          aria-label="Search resources"
          placeholder="Search resources"
          className="rounded border px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Category"
          className="rounded border px-2 py-2"
          value={category}
          onChange={(e) => setCategory(e.target.value as ResourceCategory | "all")}
        >
          <option value="all">All categories</option>
          {RESOURCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bookmarkedOnly} onChange={(e) => setBookmarkedOnly(e.target.checked)} />
          Bookmarked only
        </label>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.length === 0 && <li className="text-sm text-gray-500">No resources match.</li>}
        {visible.map((r) => (
          <li key={r.id} className="flex flex-col justify-between gap-2 rounded border p-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link href={r.href} className="font-medium underline">
                  {r.title}
                </Link>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{r.category}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{r.description}</p>
            </div>
            <button
              type="button"
              aria-pressed={bookmarks.has(r.id)}
              aria-label={`Bookmark ${r.title}`}
              className="self-start rounded border px-2 py-1 text-sm"
              onClick={() => toggle(r.id)}
            >
              {bookmarks.has(r.id) ? "Bookmarked" : "Bookmark"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
