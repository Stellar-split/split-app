"use client";

import { useCallback, useEffect, useState } from "react";

export interface AdvancedFilterRule {
  /** Minimum amount in USDC (stroops / 10_000_000), empty string = no lower bound. */
  amountMin: string;
  /** Maximum amount in USDC, empty string = no upper bound. */
  amountMax: string;
  /** Tags that an invoice must carry at least one of. Empty array = no tag filter. */
  tags: string[];
  /** Creator Stellar address (partial or full). Empty string = no creator filter. */
  creatorAddress: string;
}

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilterRule = {
  amountMin: "",
  amountMax: "",
  tags: [],
  creatorAddress: "",
};

const STORAGE_KEY = "stellarsplit_advanced_filter_rules";

function readRules(): AdvancedFilterRule {
  if (typeof window === "undefined") return { ...DEFAULT_ADVANCED_FILTERS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ADVANCED_FILTERS };
    const parsed = JSON.parse(raw);
    return {
      amountMin: typeof parsed.amountMin === "string" ? parsed.amountMin : "",
      amountMax: typeof parsed.amountMax === "string" ? parsed.amountMax : "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === "string") : [],
      creatorAddress: typeof parsed.creatorAddress === "string" ? parsed.creatorAddress : "",
    };
  } catch {
    return { ...DEFAULT_ADVANCED_FILTERS };
  }
}

function writeRules(rules: AdvancedFilterRule): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // localStorage unavailable
  }
}

/**
 * Returns true when at least one rule is active (non-default).
 */
export function hasActiveAdvancedFilters(rules: AdvancedFilterRule): boolean {
  return (
    rules.amountMin !== "" ||
    rules.amountMax !== "" ||
    rules.tags.length > 0 ||
    rules.creatorAddress !== ""
  );
}

/**
 * Count the number of active rules for the badge indicator.
 */
export function countActiveAdvancedFilters(rules: AdvancedFilterRule): number {
  let n = 0;
  if (rules.amountMin !== "") n++;
  if (rules.amountMax !== "") n++;
  if (rules.tags.length > 0) n++;
  if (rules.creatorAddress !== "") n++;
  return n;
}

/**
 * Apply the advanced filter rules to a list of invoices.
 *
 * @param invoices  Raw invoice objects (any shape — we only access the fields
 *                  that the SDK guarantees: `recipients[].amount`, `creator`).
 * @param rules     The current AdvancedFilterRule state.
 * @param tagMap    Optional map of invoiceId → string[] from the tag store.
 */
export function applyAdvancedFilters<T extends {
  id: string | number;
  creator?: string;
  recipients: Array<{ amount: bigint | number | string }>;
}>(
  invoices: T[],
  rules: AdvancedFilterRule,
  tagMap: Record<string, string[]> = {}
): T[] {
  const minUsdc = rules.amountMin !== "" ? parseFloat(rules.amountMin) : null;
  const maxUsdc = rules.amountMax !== "" ? parseFloat(rules.amountMax) : null;
  const lowerCreator = rules.creatorAddress.trim().toLowerCase();

  return invoices.filter((inv) => {
    // ── Amount range ──────────────────────────────────────────────────────
    if (minUsdc !== null || maxUsdc !== null) {
      const totalStroops = inv.recipients.reduce((s, r) => {
        const raw = r.amount;
        return s + (typeof raw === "bigint" ? Number(raw) : Number(raw));
      }, 0);
      const totalUsdc = totalStroops / 10_000_000;
      if (minUsdc !== null && totalUsdc < minUsdc) return false;
      if (maxUsdc !== null && totalUsdc > maxUsdc) return false;
    }

    // ── Tag filter ────────────────────────────────────────────────────────
    if (rules.tags.length > 0) {
      const invoiceTags = tagMap[String(inv.id)] ?? [];
      const invoiceTagsLower = invoiceTags.map((t) => t.toLowerCase());
      const hasTag = rules.tags.some((t) => invoiceTagsLower.includes(t.toLowerCase()));
      if (!hasTag) return false;
    }

    // ── Creator address ───────────────────────────────────────────────────
    if (lowerCreator) {
      const creator = (inv.creator ?? "").toLowerCase();
      if (!creator.includes(lowerCreator)) return false;
    }

    return true;
  });
}

export interface UseAdvancedInvoiceFiltersResult {
  rules: AdvancedFilterRule;
  setRules: (rules: AdvancedFilterRule) => void;
  resetRules: () => void;
  hasActive: boolean;
  activeCount: number;
}

/**
 * Hook that manages advanced invoice filter rules with localStorage persistence.
 */
export function useAdvancedInvoiceFilters(): UseAdvancedInvoiceFiltersResult {
  const [rules, setRulesState] = useState<AdvancedFilterRule>(DEFAULT_ADVANCED_FILTERS);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setRulesState(readRules());
  }, []);

  const setRules = useCallback((next: AdvancedFilterRule) => {
    setRulesState(next);
    writeRules(next);
  }, []);

  const resetRules = useCallback(() => {
    setRulesState({ ...DEFAULT_ADVANCED_FILTERS });
    writeRules({ ...DEFAULT_ADVANCED_FILTERS });
  }, []);

  return {
    rules,
    setRules,
    resetRules,
    hasActive: hasActiveAdvancedFilters(rules),
    activeCount: countActiveAdvancedFilters(rules),
  };
}
