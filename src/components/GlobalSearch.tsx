"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Invoice } from "@stellar-split/sdk";
import { truncateAddress } from "@stellar-split/sdk";

function useDebounce<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const re = new RegExp(`(${escapeRe(q)})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-brand-500/30 text-brand-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface SearchResults {
  invoices: Invoice[];
  addresses: { address: string; invoiceId: string }[];
}

function filterResults(
  invoices: Invoice[],
  query: string,
  publicKey: string | null,
  allPublic: boolean
): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { invoices: [], addresses: [] };

  const pool = allPublic || !publicKey
    ? invoices
    : invoices.filter(
        (inv) =>
          inv.creator === publicKey ||
          inv.recipients.some((r) => r.address === publicKey)
      );

  const matchedInvoices = pool.filter(
    (inv) =>
      inv.id.toLowerCase().includes(q) ||
      (inv as Invoice & { title?: string }).title?.toLowerCase().includes(q) ||
      inv.creator.toLowerCase().includes(q) ||
      inv.recipients.some((r) => r.address.toLowerCase().includes(q))
  );

  const seenAddresses = new Set<string>();
  const addresses: { address: string; invoiceId: string }[] = [];
  for (const inv of pool) {
    for (const r of inv.recipients) {
      if (r.address.toLowerCase().includes(q) && !seenAddresses.has(r.address)) {
        seenAddresses.add(r.address);
        addresses.push({ address: r.address, invoiceId: inv.id });
      }
    }
  }

  return { invoices: matchedInvoices.slice(0, 5), addresses: addresses.slice(0, 5) };
}

interface Props {
  invoices: Invoice[];
  publicKey: string | null;
}

export default function GlobalSearch({ invoices, publicKey }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allPublic, setAllPublic] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debounced = useDebounce(query, 300);
  const results = filterResults(invoices, debounced, publicKey, allPublic);
  const totalCount = results.invoices.length + results.addresses.length;
  const hasQuery = debounced.trim().length > 0;

  // Flat list of navigable items for keyboard nav
  const items: { type: "invoice" | "address"; id: string; href: string }[] = [
    ...results.invoices.map((inv) => ({
      type: "invoice" as const,
      id: inv.id,
      href: `/invoice/${inv.id}`,
    })),
    ...results.addresses.map((a) => ({
      type: "address" as const,
      id: a.address,
      href: `/creator/${a.address}`,
    })),
  ];

  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open ? closeSearch() : openSearch();
      }
      if (e.key === "Escape" && open) closeSearch();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, openSearch, closeSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[activeIndex]) {
      router.push(items[activeIndex].href);
      closeSearch();
    }
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced]);

  return (
    <>
      {/* Trigger button in navbar */}
      <button
        onClick={openSearch}
        aria-label="Open search (Ctrl+K)"
        className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-slate-400 hover:text-white text-small transition-colors border border-white/[0.06]"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden md:inline text-xs bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>

      {/* Mobile icon-only trigger */}
      <button
        onClick={openSearch}
        aria-label="Open search"
        className="flex sm:hidden items-center justify-center h-9 w-9 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeSearch()}
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
        >
          <div className="w-full max-w-lg bg-surface-800 rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 shrink-0" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search invoices, IDs, addresses…"
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 text-sm outline-none"
                aria-label="Search"
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                aria-controls="search-results"
                aria-activedescendant={items[activeIndex] ? `search-item-${activeIndex}` : undefined}
              />
              <kbd
                onClick={closeSearch}
                className="text-xs text-slate-500 bg-white/[0.06] px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-white/[0.1]"
              >
                Esc
              </kbd>
            </div>

            {/* Toggle */}
            {publicKey && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] text-xs text-slate-500">
                <button
                  onClick={() => setAllPublic(false)}
                  className={`px-2 py-0.5 rounded-full transition-colors ${!allPublic ? "bg-brand-600/30 text-brand-300" : "hover:text-slate-300"}`}
                >
                  My invoices
                </button>
                <span>/</span>
                <button
                  onClick={() => setAllPublic(true)}
                  className={`px-2 py-0.5 rounded-full transition-colors ${allPublic ? "bg-brand-600/30 text-brand-300" : "hover:text-slate-300"}`}
                >
                  All public invoices
                </button>
              </div>
            )}

            {/* Results */}
            <ul
              id="search-results"
              ref={listRef}
              role="listbox"
              className="max-h-80 overflow-y-auto py-2"
            >
              {!hasQuery && (
                <li className="px-4 py-6 text-center text-sm text-slate-500">
                  Start typing to search invoices and addresses…
                </li>
              )}

              {hasQuery && totalCount === 0 && (
                <li className="px-4 py-6 flex flex-col items-center gap-3 text-center">
                  <span className="text-2xl" aria-hidden="true">🔍</span>
                  <p className="text-sm text-slate-400">No results for <span className="text-white">&ldquo;{debounced}&rdquo;</span></p>
                  <a
                    href="/invoice/new"
                    onClick={closeSearch}
                    className="text-sm text-brand-400 hover:text-brand-300 underline transition-colors"
                  >
                    Create new invoice →
                  </a>
                </li>
              )}

              {results.invoices.length > 0 && (
                <>
                  <li className="px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Invoices
                  </li>
                  {results.invoices.map((inv, idx) => {
                    const globalIdx = idx;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <li
                        key={inv.id}
                        id={`search-item-${globalIdx}`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <button
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isActive ? "bg-brand-600/20" : "hover:bg-white/[0.04]"}`}
                          onClick={() => { router.push(`/invoice/${inv.id}`); closeSearch(); }}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm text-white font-medium">
                              Invoice #<Highlight text={inv.id} query={debounced} />
                              {(inv as Invoice & { title?: string }).title && (
                                <span className="ml-2 text-slate-400 font-normal">
                                  — <Highlight text={(inv as Invoice & { title?: string }).title!} query={debounced} />
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-slate-500 font-mono truncate">
                              <Highlight text={inv.creator} query={debounced} />
                            </span>
                          </div>
                          <span className={`shrink-0 ml-3 text-xs px-2 py-0.5 rounded-full font-semibold ${
                            inv.status === "Released" ? "bg-green-500/20 text-green-400" :
                            inv.status === "Refunded" ? "bg-gray-500/20 text-gray-400" :
                            "bg-yellow-500/20 text-yellow-400"
                          }`}>
                            {inv.status}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </>
              )}

              {results.addresses.length > 0 && (
                <>
                  <li className="px-4 py-1.5 mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider border-t border-white/[0.04]">
                    Addresses
                  </li>
                  {results.addresses.map((a, idx) => {
                    const globalIdx = results.invoices.length + idx;
                    const isActive = activeIndex === globalIdx;
                    return (
                      <li
                        key={a.address}
                        id={`search-item-${globalIdx}`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <button
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? "bg-brand-600/20" : "hover:bg-white/[0.04]"}`}
                          onClick={() => { router.push(`/creator/${a.address}`); closeSearch(); }}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                        >
                          <span className="text-lg" aria-hidden="true">👤</span>
                          <span className="text-sm text-white font-mono truncate">
                            <Highlight text={a.address} query={debounced} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </>
              )}
            </ul>

            {/* Footer hint */}
            <div className="border-t border-white/[0.04] px-4 py-2 flex items-center gap-3 text-xs text-slate-600">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
