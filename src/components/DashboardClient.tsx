"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import InvoiceSearch from "@/components/InvoiceSearch";
import InvoiceCard from "@/components/InvoiceCard";
import { SkeletonCard } from "@/components/Skeleton";
import BatchPayModal from "@/components/BatchPayModal";
import type { Invoice } from "@stellar-split/sdk";

/**
 * Client component for dashboard with streaming invoice list.
 * The invoice list is fetched and rendered progressively while
 * the page shell is immediately visible.
 */
export default function DashboardClient() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [numericResult, setNumericResult] = useState<Invoice | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Get wallet public key
  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() =>
        setError("Connect your Freighter wallet to view your dashboard."),
      );
  }, []);

  // Fetch invoices progressively
  useEffect(() => {
    if (!publicKey) return;

    const fetchInvoices = async () => {
      setLoading(true);
      const results: Invoice[] = [];
      
      // Fetch invoices one by one and update state progressively
      for (let id = 1; id <= 50; id++) {
        try {
          const inv = await splitClient.getInvoice(String(id));
          const isCreator = inv.creator === publicKey;
          const isRecipient = inv.recipients.some(
            (r) => r.address === publicKey,
          );
          if (isCreator || isRecipient) {
            results.push(inv);
            // Update state after each invoice to enable progressive rendering
            setInvoices([...results]);
          }
        } catch {
          break;
        }
      }
      setLoading(false);
    };

    fetchInvoices().catch((e) => {
      setError(String(e));
      setLoading(false);
    });
  }, [publicKey]);

  // Numeric search with debounce
  useEffect(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      setNumericResult(null);
      setSearchLoading(false);
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      setNumericResult(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const t = window.setTimeout(async () => {
      try {
        const inv = await splitClient.getInvoice(trimmed);
        if (!cancelled) setNumericResult(inv);
      } catch {
        if (!cancelled) setNumericResult(null);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchValue]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitMultiSelect = () => {
    setMultiSelect(false);
    setSelected(new Set());
  };

  const pendingInvoices = invoices.filter((inv) => inv.status === "Pending");
  const selectedInvoices = invoices.filter((inv) => selected.has(inv.id));

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-10 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2 flex-wrap">
          {!multiSelect && pendingInvoices.length > 0 && (
            <button
              onClick={() => setMultiSelect(true)}
              className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors"
              aria-label="Enter multi-select mode to pay multiple invoices"
            >
              Pay Multiple
            </button>
          )}
          {multiSelect && (
            <>
              <button
                onClick={exitMultiSelect}
                className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowBatchModal(true)}
                disabled={selected.size === 0}
                className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
                aria-label={`Pay ${selected.size} selected invoice${selected.size !== 1 ? "s" : ""}`}
              >
                Pay Selected ({selected.size})
              </button>
            </>
          )}
          <Link
            href="/invoice/new"
            className="min-h-11 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
            + New Invoice
          </Link>
        </div>
      </div>

      <InvoiceSearch
        invoices={invoices}
        searchValue={searchValue}
        onSearchChange={(next) => {
          setSearchValue(next);
        }}
        numericResult={numericResult}
        loading={searchLoading}
        onNumericResult={setNumericResult}
      />

      {multiSelect && (
        <p className="text-sm text-gray-400 mb-4" role="status">
          Select pending invoices to pay in a single transaction.
        </p>
      )}

      {loading && invoices.length === 0 ? (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <p className="text-gray-400">
          No invoices found. Create your first one!
        </p>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Invoice list">
          {invoices.map((inv) => {
            const isSelectable = multiSelect && inv.status === "Pending";
            const isSelected = selected.has(inv.id);

            return (
              <li key={inv.id}>
                {isSelectable ? (
                  <button
                    type="button"
                    onClick={() => toggleSelect(inv.id)}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Deselect" : "Select"} Invoice #${inv.id}`}
                    className={`w-full text-left rounded-xl ring-2 transition-all ${
                      isSelected
                        ? "ring-indigo-500"
                        : "ring-transparent hover:ring-gray-600"
                    }`}
                  >
                    <div className="relative">
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold z-10"
                        >
                          ✓
                        </span>
                      )}
                      <InvoiceCard invoice={inv} />
                    </div>
                  </button>
                ) : (
                  <Link
                    href={`/invoice/${inv.id}`}
                    aria-label={`View Invoice #${inv.id}`}
                  >
                    <InvoiceCard invoice={inv} />
                  </Link>
                )}
              </li>
            );
          })}
          {loading && (
            <>
              {[...Array(2)].map((_, i) => (
                <li key={`skeleton-${i}`}>
                  <SkeletonCard />
                </li>
              ))}
            </>
          )}
        </ul>
      )}

      {showBatchModal && publicKey && selectedInvoices.length > 0 && (
        <BatchPayModal
          invoices={selectedInvoices}
          publicKey={publicKey}
          onClose={() => {
            setShowBatchModal(false);
            exitMultiSelect();
          }}
        />
      )}
    </>
  );
}
