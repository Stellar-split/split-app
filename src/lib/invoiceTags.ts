/**
 * invoiceTags — normalization, validation and storage for invoice tags.
 *
 * Invoices themselves are on-chain (see `Invoice` in @stellar-split/sdk) and
 * have no room for user metadata, so tags are kept off-chain keyed by invoice
 * id — the same approach `api/invoices/[id]/route.ts` uses for splitMeta.
 */
import { z } from "zod";

export const MAX_TAG_LENGTH = 32;
export const MAX_TAGS_PER_INVOICE = 20;
/** Maximum autocomplete suggestions surfaced by TagInput. */
export const MAX_TAG_SUGGESTIONS = 10;

/**
 * Normalize a single tag: trim, collapse inner whitespace, lowercase.
 * Lowercasing makes "Design" and "design" the same tag, so filtering by one
 * finds invoices labelled with the other.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, MAX_TAG_LENGTH);
}

/** Normalize a list of tags, dropping empties and duplicates, preserving order. */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of raw) {
    const normalized = normalizeTag(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= MAX_TAGS_PER_INVOICE) break;
  }
  return out;
}

/**
 * Split free text on the delimiters the tag input accepts (comma and newline).
 * Enter is handled by the component itself since it isn't a character.
 */
export function splitTagInput(text: string): string[] {
  return normalizeTags(text.split(/[,\n]/));
}

export const TagsPayloadSchema = z.object({
  tags: z.array(z.string()).max(MAX_TAGS_PER_INVOICE, "Too many tags"),
});

export type TagsPayload = z.infer<typeof TagsPayloadSchema>;

// ── Storage ────────────────────────────────────────────────────────────────
// In-memory for now, matching the existing splitMeta store. Swapping this for
// a database only requires reimplementing the four functions below.

const tagStore = new Map<string, string[]>();

export function getTags(invoiceId: string): string[] {
  return tagStore.get(invoiceId) ?? [];
}

export function setTags(invoiceId: string, tags: readonly string[]): string[] {
  const normalized = normalizeTags(tags);
  if (normalized.length === 0) {
    tagStore.delete(invoiceId);
  } else {
    tagStore.set(invoiceId, normalized);
  }
  return normalized;
}

/** Every distinct tag in use, sorted alphabetically — powers autocomplete. */
export function getAllTags(): string[] {
  const all = new Set<string>();
  for (const tags of Array.from(tagStore.values())) {
    for (const tag of tags) all.add(tag);
  }
  return Array.from(all).sort();
}

/** Map of invoiceId → tags, for filtering an invoice list in one round trip. */
export function getTagMap(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [id, tags] of Array.from(tagStore.entries())) {
    out[id] = tags;
  }
  return out;
}

/** Test seam — clears all stored tags. */
export function __resetTagStore(): void {
  tagStore.clear();
}

// ── Client-side helpers ────────────────────────────────────────────────────

/**
 * Autocomplete matches for a partial tag, capped at MAX_TAG_SUGGESTIONS.
 * Prefix matches rank above substring matches; already-applied tags are hidden.
 */
export function suggestTags(
  query: string,
  allTags: readonly string[],
  applied: readonly string[] = []
): string[] {
  const q = normalizeTag(query);
  const appliedSet = new Set(applied.map(normalizeTag));
  const candidates = allTags.filter((t) => !appliedSet.has(t));

  const pool = q ? candidates.filter((t) => t.includes(q)) : candidates;

  return pool
    .slice()
    .sort((a, b) => {
      if (q) {
        const aPrefix = a.startsWith(q);
        const bPrefix = b.startsWith(q);
        if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
      }
      return a.localeCompare(b);
    })
    .slice(0, MAX_TAG_SUGGESTIONS);
}

/** True when the invoice carries the given tag (case-insensitive). */
export function invoiceHasTag(tags: readonly string[], tag: string): boolean {
  const target = normalizeTag(tag);
  if (!target) return true;
  return tags.some((t) => normalizeTag(t) === target);
}

/**
 * Deterministic pill colour for a tag, so the same label always looks the same
 * across cards and the detail page.
 */
export const TAG_COLORS = [
  "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  "bg-amber-500/15 text-amber-300 border-amber-500/40",
  "bg-rose-500/15 text-rose-300 border-rose-500/40",
  "bg-violet-500/15 text-violet-300 border-violet-500/40",
] as const;

export function tagColorClass(tag: string): string {
  let hash = 0;
  const normalized = normalizeTag(tag);
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return TAG_COLORS[hash % TAG_COLORS.length];
}
