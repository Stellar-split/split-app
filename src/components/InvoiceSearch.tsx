"use client";

import { useEffect, useMemo, useState } from "react";
import type { Invoice } from "@stellar-split/sdk";
import Link from "next/link";
import InvoiceCard from "@/components/InvoiceCard";

function isNumericId(value: string) {
  return /^\d+$/.test(value.trim());
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(re);

  return (
    <>
      {parts.map((part, idx) => {
        const isMatch = part.toLowerCase() === q.toLowerCase();
        return isMatch ? (
          <mark
            key={idx}
            className="bg-yellow-400/30 text-yellow-200 px-0.5 rounded"
          >
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        );
      })}
    </>
  );
}

function useDebounce<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

export default function InvoiceSearch({
  invoices,
  onNumericResult,
  onSearchChange,
  searchValue,
  numericResult,
  loading,
}: {
  invoices: Invoice[];
  searchValue: string;
  onSearchChange: (next: string) => void;
  numericResult: Invoice | null;
  loading: boolean;
  onNumericResult: (inv: Invoice | null) => void;
}) {
  const debounced = useDebounce(searchValue, 300);

  const [addressResults, setAddressResults] = useState<Invoice[]>([]);

  const matchedQuery = useMemo(() => debounced.trim(), [debounced]);

  useEffect(() => {
    if (!matchedQuery) {
      setAddressResults([]);
      onNumericResult(null);
      return;
    }

    if (isNumericId(matchedQuery)) {
      // numeric lookups handled by parent via onSearchChange
      setAddressResults([]);
      return;
    }

    // Address substring filter across loaded invoices
    const lower = matchedQuery.toLowerCase();
    const filtered = invoices.filter((inv) =>
      inv.recipients.some((r) => r.address.toLowerCase().includes(lower)),
    );

    setAddressResults(filtered);
    onNumericResult(null);
  }, [invoices, matchedQuery, onNumericResult]);

  const showNoResults =
    matchedQuery.length > 0 &&
    !loading &&
    (isNumericId(matchedQuery) ? !numericResult : addressResults.length === 0);

  const results = isNumericId(matchedQuery)
    ? numericResult
      ? [numericResult]
      : []
    : addressResults;

  return (
    <section className="mb-6">
      <label className="sr-only" htmlFor="invoice-search">
        Search invoices
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          id="invoice-search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          inputMode="numeric"
          placeholder="Search by invoice ID or recipient address"
          className="w-full sm:flex-1 px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 mt-3" role="status">
          Searching…
        </p>
      ) : null}

      {showNoResults ? (
        <p className="text-sm text-gray-400 mt-3" role="status">
          No results.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="flex flex-col gap-4 mt-4" aria-label="Search results">
          {results.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoice/${inv.id}`}
                aria-label={`View Invoice #${inv.id}`}
              >
                <div className="rounded-xl overflow-hidden">
                  <div className="p-0.5 bg-gradient-to-r from-indigo-500/30 via-yellow-400/20 to-indigo-500/30">
                    <div className="bg-gray-900 rounded-xl">
                      <div className="px-5 pt-4 pb-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-300">
                            Invoice #{inv.id}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-800 text-gray-300">
                            {inv.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {inv.recipients.map((r, i) => (
                            <span
                              key={i}
                              className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono"
                            >
                              <Highlight
                                text={r.address}
                                query={matchedQuery}
                              />
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="px-5 pb-5">
                        {/* Reuse the existing card visuals, but recipients area is already shown. */}
                        <InvoiceCard invoice={inv} />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
