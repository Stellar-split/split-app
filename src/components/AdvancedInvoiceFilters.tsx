"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeTag, tagColorClass } from "@/lib/invoiceTags";
import {
  type AdvancedFilterRule,
  DEFAULT_ADVANCED_FILTERS,
  countActiveAdvancedFilters,
  hasActiveAdvancedFilters,
} from "@/hooks/useAdvancedInvoiceFilters";

interface AdvancedInvoiceFiltersProps {
  /** Current filter rule values (controlled from parent). */
  rules: AdvancedFilterRule;
  /** Available tags from the invoice tag store for autocomplete. */
  availableTags?: string[];
  /** Called when the user applies new filter rules. */
  onApply: (rules: AdvancedFilterRule) => void;
  /** Called when the user resets all filters. */
  onReset: () => void;
  className?: string;
}

/**
 * Advanced invoice filtering panel with:
 * - Amount range (min/max USDC)
 * - Tag multi-select with autocomplete
 * - Creator address (partial match)
 *
 * The component is self-contained — it keeps a local draft while the user
 * edits, and only calls `onApply` when they press "Apply Filters".
 */
export default function AdvancedInvoiceFilters({
  rules,
  availableTags = [],
  onApply,
  onReset,
  className = "",
}: AdvancedInvoiceFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Local draft state — copied from `rules` whenever the panel opens
  const [draft, setDraft] = useState<AdvancedFilterRule>({ ...DEFAULT_ADVANCED_FILTERS });

  // Tag autocomplete state
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeCount = countActiveAdvancedFilters(rules);

  // Sync draft when panel opens
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...rules });
      setTagInput("");
    }
  }, [isOpen, rules]);

  // Compute tag suggestions
  useEffect(() => {
    const q = normalizeTag(tagInput);
    const appliedSet = new Set(draft.tags.map((t) => t.toLowerCase()));
    const filtered = availableTags
      .filter((t) => !appliedSet.has(t.toLowerCase()) && (q === "" || t.includes(q)))
      .slice(0, 8);
    setTagSuggestions(filtered);
  }, [tagInput, draft.tags, availableTags]);

  // Close on Escape or outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const updateDraft = (partial: Partial<AdvancedFilterRule>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const addTag = (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized || draft.tags.includes(normalized)) return;
    updateDraft({ tags: [...draft.tags, normalized] });
    setTagInput("");
    tagInputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    updateDraft({ tags: draft.tags.filter((t) => t !== tag) });
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && draft.tags.length > 0) {
      removeTag(draft.tags[draft.tags.length - 1]);
    }
  };

  const handleApply = () => {
    onApply(draft);
    setIsOpen(false);
  };

  const handleReset = () => {
    onReset();
    setDraft({ ...DEFAULT_ADVANCED_FILTERS });
    setTagInput("");
    setIsOpen(false);
  };

  const draftHasActive = hasActiveAdvancedFilters(draft);

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
          activeCount > 0
            ? "bg-indigo-700/20 border-indigo-600 text-indigo-300 hover:bg-indigo-700/30"
            : "bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Advanced Filters
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-indigo-600 text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Advanced invoice filters"
          className="absolute z-40 top-full mt-2 left-0 w-80 sm:w-96 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-5 flex flex-col gap-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Advanced Filters</h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close filters panel"
              className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Amount Range (USDC)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.amountMin}
                onChange={(e) => updateDraft({ amountMin: e.target.value })}
                placeholder="Min"
                aria-label="Minimum amount in USDC"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <span className="text-gray-500 text-sm shrink-0">–</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.amountMax}
                onChange={(e) => updateDraft({ amountMax: e.target.value })}
                placeholder="Max"
                aria-label="Maximum amount in USDC"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Tag Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Tags
            </label>

            {/* Applied tags */}
            {draft.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {draft.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${tagColorClass(tag)}`}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                      className="hover:opacity-70 transition-opacity"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag input + suggestions */}
            <div className="relative">
              <div className="flex gap-2">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Filter by tag…"
                  aria-label="Add tag filter"
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  disabled={!tagInput.trim()}
                  className="px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Suggestion dropdown */}
              {tagSuggestions.length > 0 && tagInput !== "" && (
                <div className="absolute z-10 top-full mt-1 left-0 right-0 rounded-lg border border-gray-700 bg-gray-800 shadow-lg overflow-hidden">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors flex items-center gap-2 ${tagColorClass(tag)}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {tagSuggestions.length === 0 && tagInput !== "" && availableTags.length > 0 && (
                <p className="mt-1 text-xs text-gray-500 px-1">No matching tags</p>
              )}
            </div>
          </div>

          {/* Creator Address */}
          <div>
            <label
              htmlFor="adv-filter-creator"
              className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2"
            >
              Creator Address
            </label>
            <input
              id="adv-filter-creator"
              type="text"
              value={draft.creatorAddress}
              onChange={(e) => updateDraft({ creatorAddress: e.target.value })}
              placeholder="G… Stellar address"
              aria-label="Filter by creator Stellar address"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder:text-gray-500 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
            <button
              type="button"
              onClick={handleReset}
              disabled={!draftHasActive && !hasActiveAdvancedFilters(rules)}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white border border-gray-700 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
            >
              Apply Filters
            </button>
          </div>

          {/* Active count indicator */}
          {draftHasActive && (
            <p className="text-center text-xs text-gray-500 -mt-2">
              {countActiveAdvancedFilters(draft)} active filter
              {countActiveAdvancedFilters(draft) !== 1 ? "s" : ""} in draft
            </p>
          )}
        </div>
      )}
    </div>
  );
}
