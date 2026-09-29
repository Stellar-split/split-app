export type ResourceCategory = "guide" | "template" | "tool" | "policy";

export interface CreatorResource {
  id: string;
  title: string;
  description: string;
  category: ResourceCategory;
  tags: string[];
  /** In-app route or absolute URL. */
  href: string;
}

export const RESOURCE_CATEGORIES: ResourceCategory[] = ["guide", "template", "tool", "policy"];

export const DEFAULT_RESOURCES: CreatorResource[] = [
  {
    id: "invoicing-basics",
    title: "Invoicing basics",
    description: "Create your first split invoice and share it with recipients.",
    category: "guide",
    tags: ["invoices", "getting-started"],
    href: "/invoice",
  },
  {
    id: "invoice-templates",
    title: "Invoice templates",
    description: "Reuse layouts and line items across invoices.",
    category: "template",
    tags: ["invoices", "templates"],
    href: "/templates",
  },
  {
    id: "rate-card",
    title: "Rate card builder",
    description: "Price your services and turn them into invoice line items.",
    category: "tool",
    tags: ["pricing", "invoices"],
    href: "/creator/rate-card",
  },
  {
    id: "tax-export",
    title: "Tax export",
    description: "Export your earnings for tax reporting.",
    category: "tool",
    tags: ["tax", "reports"],
    href: "/revenue",
  },
];

export interface ResourceFilter {
  query?: string;
  category?: ResourceCategory | "all";
  bookmarkedOnly?: boolean;
}

export function filterResources(
  resources: CreatorResource[],
  filter: ResourceFilter = {},
  bookmarks: ReadonlySet<string> = new Set(),
): CreatorResource[] {
  const q = filter.query?.trim().toLowerCase() ?? "";
  return resources
    .filter((r) => !filter.category || filter.category === "all" || r.category === filter.category)
    .filter((r) => !filter.bookmarkedOnly || bookmarks.has(r.id))
    .filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
}

export function toggleBookmark(bookmarks: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(bookmarks);
  if (!next.delete(id)) next.add(id);
  return next;
}

const STORAGE_KEY = "creator-resource-bookmarks";

/** Loads saved bookmarks; returns an empty set when storage is unavailable or corrupt. */
export function loadBookmarks(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveBookmarks(bookmarks: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
  } catch {
    // Storage may be unavailable (private mode / quota); bookmarks are best-effort.
  }
}
