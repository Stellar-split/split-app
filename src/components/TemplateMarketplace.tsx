"use client";

import { useState, useMemo } from "react";
import { type UserTemplate } from "@/components/TemplateManager";

// ─── Marketplace data ──────────────────────────────────────────────────────────

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  category: "Freelance" | "Agency" | "SaaS" | "Creator" | "Consulting";
  tags: string[];
  downloads: number;
  token: "USDC" | "XLM";
  recipients: { label: string; address: string; amount: string }[];
  author: string;
  featured?: boolean;
}

const MARKETPLACE_TEMPLATES: MarketplaceTemplate[] = [
  {
    id: "mkt-001",
    name: "Freelance Design Sprint",
    description: "A ready-to-use invoice template for a 5-day design sprint with milestone splits.",
    category: "Freelance",
    tags: ["design", "sprint", "milestone"],
    downloads: 1420,
    token: "USDC",
    author: "StellarSplit Team",
    featured: true,
    recipients: [
      { label: "Upfront (50%)", address: "", amount: "500" },
      { label: "Final delivery (50%)", address: "", amount: "500" },
    ],
  },
  {
    id: "mkt-002",
    name: "Agency Retainer",
    description: "Monthly agency retainer split across 3 deliverable phases.",
    category: "Agency",
    tags: ["retainer", "monthly", "agency"],
    downloads: 987,
    token: "USDC",
    author: "StellarSplit Team",
    featured: true,
    recipients: [
      { label: "Strategy (30%)", address: "", amount: "300" },
      { label: "Production (50%)", address: "", amount: "500" },
      { label: "Review & QA (20%)", address: "", amount: "200" },
    ],
  },
  {
    id: "mkt-003",
    name: "SaaS License Invoice",
    description: "Annual SaaS licensing with setup fee split from recurring.",
    category: "SaaS",
    tags: ["saas", "license", "annual"],
    downloads: 732,
    token: "USDC",
    author: "community",
    recipients: [
      { label: "Setup fee", address: "", amount: "200" },
      { label: "Annual license", address: "", amount: "800" },
    ],
  },
  {
    id: "mkt-004",
    name: "Creator Collaboration",
    description: "Equal split for two co-creators on a content project.",
    category: "Creator",
    tags: ["content", "collab", "equal-split"],
    downloads: 1105,
    token: "USDC",
    author: "community",
    recipients: [
      { label: "Creator A", address: "", amount: "500" },
      { label: "Creator B", address: "", amount: "500" },
    ],
  },
  {
    id: "mkt-005",
    name: "Consulting Day Rate",
    description: "Simple single-recipient consulting invoice with one-day rate.",
    category: "Consulting",
    tags: ["consulting", "day-rate", "simple"],
    downloads: 604,
    token: "USDC",
    author: "community",
    recipients: [
      { label: "Consulting fee", address: "", amount: "750" },
    ],
  },
  {
    id: "mkt-006",
    name: "XLM Freelance Quick",
    description: "Fast single-payment freelance invoice denominated in XLM.",
    category: "Freelance",
    tags: ["xlm", "quick", "single"],
    downloads: 318,
    token: "XLM",
    author: "community",
    recipients: [
      { label: "Project fee", address: "", amount: "1000" },
    ],
  },
  {
    id: "mkt-007",
    name: "Three-Phase Project",
    description: "Classic 3-phase project: kickoff, mid-review, and delivery.",
    category: "Agency",
    tags: ["3-phase", "project", "milestones"],
    downloads: 854,
    token: "USDC",
    author: "StellarSplit Team",
    featured: true,
    recipients: [
      { label: "Kickoff (33%)", address: "", amount: "333" },
      { label: "Mid-review (33%)", address: "", amount: "333" },
      { label: "Delivery (34%)", address: "", amount: "334" },
    ],
  },
];

const CATEGORIES = ["All", "Freelance", "Agency", "SaaS", "Creator", "Consulting"] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function totalAmount(recipients: MarketplaceTemplate["recipients"]): number {
  return recipients.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    Freelance: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    Agency: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    SaaS: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    Creator: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    Consulting: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[cat] ?? "bg-gray-700 text-gray-300 border-gray-600"}`}>
      {cat}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  /** Called when user wants to import a marketplace template into their library */
  onImport: (t: UserTemplate) => void;
  /** Already-imported template IDs to prevent duplicates */
  importedIds: Set<string>;
}

export default function TemplateMarketplace({ onImport, importedIds }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [sortBy, setSortBy] = useState<"popular" | "newest">("popular");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [justImported, setJustImported] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = [...MARKETPLACE_TEMPLATES];
    if (category !== "All") list = list.filter((t) => t.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q))
      );
    }
    if (sortBy === "popular") list.sort((a, b) => b.downloads - a.downloads);
    return list;
  }, [search, category, sortBy]);

  const featured = MARKETPLACE_TEMPLATES.filter((t) => t.featured);
  const previewTemplate = MARKETPLACE_TEMPLATES.find((t) => t.id === previewId);

  const handleImport = (t: MarketplaceTemplate) => {
    const userTemplate: UserTemplate = {
      name: t.name,
      recipients: t.recipients.map((r) => ({ label: r.label, address: r.address, amount: r.amount })),
      token: t.token || undefined,
      createdAt: new Date().toISOString(),
      // store marketplace id as part of the name for dedup tracking
    };
    onImport(userTemplate);
    setJustImported((prev) => new Set(prev).add(t.id));
    setPreviewId(null);
  };

  const isImported = (id: string) => importedIds.has(id) || justImported.has(id);

  return (
    <section aria-labelledby="marketplace-heading" className="mt-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 id="marketplace-heading" className="text-xl font-bold text-white">
            Template Marketplace
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Browse and import community templates into your library.</p>
        </div>
      </div>

      {/* Featured strip */}
      {featured.length > 0 && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3 font-semibold">
            ⭐ Featured
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {featured.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPreviewId(t.id)}
                className="text-left bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-4 hover:bg-indigo-600/20 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-white leading-snug">{t.name}</p>
                  <CategoryBadge cat={t.category} />
                </div>
                <p className="text-xs text-gray-400 line-clamp-2">{t.description}</p>
                <p className="text-xs text-indigo-400 mt-2">{t.downloads.toLocaleString()} imports</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="search"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Filter by category"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "popular" | "newest")}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Sort by"
          >
            <option value="popular">Most Popular</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-10">No templates match your search.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <li key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white leading-snug">{t.name}</p>
                <CategoryBadge cat={t.category} />
              </div>
              <p className="text-xs text-gray-400 flex-1 line-clamp-2">{t.description}</p>
              <div className="flex flex-wrap gap-1">
                {t.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-800 text-gray-500 rounded px-1.5 py-0.5">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{t.recipients.length} recipient{t.recipients.length !== 1 ? "s" : ""} · {t.token}</span>
                <span>{t.downloads.toLocaleString()} imports</span>
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPreviewId(t.id)}
                  className="flex-1 min-h-9 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleImport(t)}
                  disabled={isImported(t.id)}
                  className={`flex-1 min-h-9 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isImported(t.id)
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  }`}
                >
                  {isImported(t.id) ? "Imported ✓" : "Import"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 id="preview-modal-title" className="text-base font-bold text-white">
                  {previewTemplate.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{previewTemplate.description}</p>
              </div>
              <CategoryBadge cat={previewTemplate.category} />
            </div>

            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Recipients</p>
              <ul className="space-y-2">
                {previewTemplate.recipients.map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{r.label}</span>
                    <span className="font-semibold text-indigo-300">
                      {r.amount} {previewTemplate.token}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-700 mt-3 pt-3 flex justify-between text-sm font-semibold">
                <span className="text-gray-400">Total</span>
                <span className="text-white">
                  {totalAmount(previewTemplate.recipients).toLocaleString()} {previewTemplate.token}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 mb-5">
              <span>By {previewTemplate.author}</span>
              <span>·</span>
              <span>{previewTemplate.downloads.toLocaleString()} imports</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                className="flex-1 min-h-10 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleImport(previewTemplate)}
                disabled={isImported(previewTemplate.id)}
                className={`flex-1 min-h-10 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isImported(previewTemplate.id)
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {isImported(previewTemplate.id) ? "Imported ✓" : "Import Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
