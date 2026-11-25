/**
 * invoiceDuplicates.ts — Invoice duplicate detection and merge utilities.
 *
 * Detection strategy:
 *   Two invoices are considered duplicates when they share the same set of
 *   (recipient address, amount) pairs AND have the same creator.  An optional
 *   deadline-proximity window can tighten or loosen the match.
 *
 * Merge strategy:
 *   The "primary" invoice is kept; duplicate invoices are flagged/hidden in
 *   localStorage.  Because we don't control on-chain state from the client,
 *   merging is a UI-level concept: the merged invoice's metadata (notes, tags)
 *   is optionally carried over to the primary record.
 *
 * Issue #813: Implement invoice duplicate detection and merge.
 */

import type { Invoice } from "@stellar-split/sdk";
import { formatAmount } from "@stellar-split/sdk";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DuplicateGroup {
  /** Stable key for the group derived from creator + recipient fingerprint. */
  key: string;
  /** All invoices that share this fingerprint (≥2). */
  invoices: Invoice[];
  /** Confidence score in [0, 1]: 1.0 = exact match, lower = fuzzy. */
  confidence: number;
  /** Human-readable reason why these are considered duplicates. */
  reason: string;
}

export type MergeStrategy = "keep-newest" | "keep-oldest" | "keep-largest";

export interface MergeResult {
  primaryId: string;
  mergedIds: string[];
  /** Total amount consolidated (in USDC string). */
  totalAmount: string;
}

// ── Fingerprinting ────────────────────────────────────────────────────────────

/**
 * Stable fingerprint for an invoice based on creator + sorted recipients.
 * Two invoices with the same fingerprint are strong-match duplicates.
 */
export function invoiceFingerprint(invoice: Invoice): string {
  const recipientParts = invoice.recipients
    .map((r) => `${r.address.toLowerCase()}:${r.amount.toString()}`)
    .sort()
    .join("|");
  return `${invoice.creator.toLowerCase()}@@${recipientParts}`;
}

/**
 * Looser fingerprint that ignores exact amounts — matches invoices with the
 * same recipients regardless of amount (fuzzy duplicate detection).
 */
export function invoiceFingerprintFuzzy(invoice: Invoice): string {
  const recipientParts = invoice.recipients
    .map((r) => r.address.toLowerCase())
    .sort()
    .join("|");
  return `${invoice.creator.toLowerCase()}@@${recipientParts}`;
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Find exact duplicates: same creator, same recipients, same amounts.
 */
export function findExactDuplicates(invoices: Invoice[]): DuplicateGroup[] {
  const groups = new Map<string, Invoice[]>();

  for (const inv of invoices) {
    const key = invoiceFingerprint(inv);
    const existing = groups.get(key);
    if (existing) {
      existing.push(inv);
    } else {
      groups.set(key, [inv]);
    }
  }

  const result: DuplicateGroup[] = [];
  for (const [key, group] of groups) {
    if (group.length >= 2) {
      result.push({
        key,
        invoices: group,
        confidence: 1.0,
        reason: "Identical creator, recipients, and amounts.",
      });
    }
  }

  return result;
}

/**
 * Find fuzzy duplicates: same creator + same recipients, but different amounts.
 * These likely represent repriced invoices sent to the same parties.
 */
export function findFuzzyDuplicates(invoices: Invoice[]): DuplicateGroup[] {
  const groups = new Map<string, Invoice[]>();

  for (const inv of invoices) {
    const key = invoiceFingerprintFuzzy(inv);
    const existing = groups.get(key);
    if (existing) {
      existing.push(inv);
    } else {
      groups.set(key, [inv]);
    }
  }

  // Exclude groups that are already exact duplicates
  const exactFingerprints = new Set(
    invoices.map((inv) => invoiceFingerprint(inv)),
  );

  const result: DuplicateGroup[] = [];
  for (const [key, group] of groups) {
    if (group.length >= 2) {
      // Only add as fuzzy if not all members share the exact same amounts
      const exactKey = invoiceFingerprint(group[0]);
      const allExact = group.every(
        (inv) => invoiceFingerprint(inv) === exactKey,
      );
      if (!allExact) {
        result.push({
          key: `fuzzy:${key}`,
          invoices: group,
          confidence: 0.7,
          reason:
            "Same creator and recipients, but different amounts — possible reprice.",
        });
      }
    }
  }

  return result;
}

/**
 * Find all duplicate groups (exact + fuzzy), deduplicating any invoice
 * that appears in multiple groups by assigning it to the highest-confidence
 * group first.
 */
export function findAllDuplicates(invoices: Invoice[]): DuplicateGroup[] {
  const exact = findExactDuplicates(invoices);
  const fuzzy = findFuzzyDuplicates(invoices);

  // Remove from fuzzy any invoice already covered by an exact group
  const exactIds = new Set(exact.flatMap((g) => g.invoices.map((inv) => inv.id)));

  const filteredFuzzy = fuzzy
    .map((g) => ({
      ...g,
      invoices: g.invoices.filter((inv) => !exactIds.has(inv.id)),
    }))
    .filter((g) => g.invoices.length >= 2);

  return [...exact, ...filteredFuzzy].sort((a, b) => b.confidence - a.confidence);
}

// ── Merge ─────────────────────────────────────────────────────────────────────

const MERGED_KEY = "merged-invoice-ids";

/**
 * Get the set of invoice IDs that have been marked as "merged" (hidden in UI).
 */
export function getMergedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MERGED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Check whether an invoice has been merged (hidden) locally.
 */
export function isInvoiceMerged(invoiceId: string): boolean {
  return getMergedIds().has(String(invoiceId));
}

/**
 * Mark duplicate invoices as merged in localStorage.
 * The primary invoice is kept; the rest are marked as merged (hidden).
 *
 * @param group   - The duplicate group to merge.
 * @param strategy - Which invoice to keep as the primary.
 * @returns MergeResult describing what happened.
 */
export function mergeInvoiceGroup(
  group: DuplicateGroup,
  strategy: MergeStrategy = "keep-newest",
): MergeResult {
  if (group.invoices.length < 2) {
    throw new Error("A duplicate group must have at least 2 invoices to merge.");
  }

  // Select primary based on strategy
  let sorted: Invoice[];
  switch (strategy) {
    case "keep-oldest":
      sorted = [...group.invoices].sort((a, b) => Number(a.id) - Number(b.id));
      break;
    case "keep-largest": {
      sorted = [...group.invoices].sort((a, b) => {
        const ta = a.recipients.reduce((s, r) => s + r.amount, 0n);
        const tb = b.recipients.reduce((s, r) => s + r.amount, 0n);
        return tb > ta ? 1 : tb < ta ? -1 : 0;
      });
      break;
    }
    case "keep-newest":
    default:
      sorted = [...group.invoices].sort((a, b) => Number(b.id) - Number(a.id));
      break;
  }

  const [primary, ...duplicates] = sorted;
  const duplicateIds = duplicates.map((inv) => String(inv.id));

  // Persist merged IDs
  const existing = getMergedIds();
  duplicateIds.forEach((id) => existing.add(id));
  localStorage.setItem(MERGED_KEY, JSON.stringify([...existing]));

  // Compute total consolidated amount
  const total = group.invoices
    .flatMap((inv) => inv.recipients)
    .reduce((sum, r) => sum + r.amount, 0n);

  return {
    primaryId: String(primary.id),
    mergedIds: duplicateIds,
    totalAmount: formatAmount(total),
  };
}

/**
 * Undo a merge: restore the given invoice IDs to the active state.
 */
export function undoMerge(invoiceIds: string[]): void {
  if (typeof window === "undefined") return;
  const merged = getMergedIds();
  invoiceIds.forEach((id) => merged.delete(id));
  localStorage.setItem(MERGED_KEY, JSON.stringify([...merged]));
}

/**
 * Filter out invoices that have been merged.
 */
export function filterMerged(invoices: Invoice[]): Invoice[] {
  const merged = getMergedIds();
  return invoices.filter((inv) => !merged.has(String(inv.id)));
}

// ── Summary helpers ───────────────────────────────────────────────────────────

/**
 * Summarise the differences between two invoices for display in the merge
 * confirmation UI.
 */
export function describeDifferences(a: Invoice, b: Invoice): string[] {
  const diffs: string[] = [];

  const totalA = a.recipients.reduce((s, r) => s + r.amount, 0n);
  const totalB = b.recipients.reduce((s, r) => s + r.amount, 0n);

  if (totalA !== totalB) {
    diffs.push(
      `Different totals: ${formatAmount(totalA)} vs ${formatAmount(totalB)} USDC`,
    );
  }

  if (a.deadline !== b.deadline) {
    const fmt = (d: number) =>
      d > 0 ? new Date(d * 1000).toLocaleDateString() : "none";
    diffs.push(`Different deadlines: ${fmt(a.deadline)} vs ${fmt(b.deadline)}`);
  }

  if (a.status !== b.status) {
    diffs.push(`Different statuses: ${a.status} vs ${b.status}`);
  }

  if (a.recipients.length !== b.recipients.length) {
    diffs.push(
      `Different recipient counts: ${a.recipients.length} vs ${b.recipients.length}`,
    );
  }

  return diffs;
}
