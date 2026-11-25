"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getFreighterPublicKey } from "@/lib/freighter";
import { useDebounce } from "@/hooks/useDebounce";
import HighlightedText from "@/components/invoice/HighlightedText";
import type { Invoice } from "@stellar-split/sdk";

const DEBOUNCE_DELAY_MS = 300;

interface InvoiceSearchProps {
  onSelectInvoice?: (invoice: Invoice) => void;
}

export default function InvoiceSearch({ onSelectInvoice }: InvoiceSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const debouncedQuery = useDebounce(inputValue, DEBOUNCE_DELAY_MS);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setPublicKey(null));
  }, []);

  const performSearch = useCallback(async () => {
    if (!debouncedQuery || !publicKey) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/invoices?publicKey=${encodeURIComponent(publicKey)}&q=${encodeURIComponent(debouncedQuery)}`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setResults(data.invoices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, publicKey]);

  useEffect(() => {
    performSearch();
  }, [debouncedQuery, performSearch]);

  const handleClear = () => {
    setInputValue("");
    setResults([]);
    setError(null);
  };

  const handleSelectInvoice = (invoice: Invoice) => {
    onSelectInvoice?.(invoice);
    router.push(`/invoice/${invoice.id}`);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Search invoices by title or memo..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-400">Searching…</div>
      )}

      {!loading && inputValue && results.length === 0 && !error && (
        <div className="text-sm text-gray-400">
          No results for &ldquo;<span className="font-medium">{inputValue}</span>&rdquo;
        </div>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((invoice) => (
            <li key={invoice.id}>
              <button
                onClick={() => handleSelectInvoice(invoice)}
                className="w-full text-left px-4 py-3 rounded-lg bg-gray-800/40 hover:bg-gray-700/40 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="font-medium text-gray-100">
                  <HighlightedText
                    text={(invoice as Invoice & { title?: string }).title || `Invoice #${invoice.id}`}
                    query={inputValue}
                  />
                </div>
                {(invoice as any).memo && (
                  <div className="text-xs text-gray-400 mt-1">
                    <HighlightedText
                      text={(invoice as any).memo}
                      query={inputValue}
                    />
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
