"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import InvoiceSearch from "@/components/InvoiceSearch";

import { formatAmount } from "@stellar-split/sdk";
import InvoiceCard from "@/components/InvoiceCard";
import { SkeletonCard } from "@/components/Skeleton";
import BatchPayModal from "@/components/BatchPayModal";
import type { Invoice } from "@stellar-split/sdk";

function exportCSV(invoices: Invoice[], from: string, to: string) {
  const fromTs = from ? new Date(from).getTime() / 1000 : 0;
  const toTs = to ? new Date(to).getTime() / 1000 : Infinity;
  const rows = invoices.filter(
    (inv) => inv.deadline >= fromTs && inv.deadline <= toTs,
  );
  const header =
    "ID,Status,Total (USDC),Funded (USDC),Deadline,Recipient Count";
  const lines = rows.map((inv) => {
    const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
    const deadline = new Date(inv.deadline * 1000).toISOString().slice(0, 10);
    return [
      inv.id,
      inv.status,
      formatAmount(total),
      formatAmount(inv.funded),
      deadline,
      inv.recipients.length,
    ].join(",");
  });
  const csv = [header, ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "invoices.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Dashboard — lists invoices where the connected wallet is creator or recipient.
 * Supports multi-select mode for batch payments.
 */
export default function DashboardPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  // Search
  const [searchValue, setSearchValue] = useState("");
  const [numericResult, setNumericResult] = useState<Invoice | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Multi-select state
  const [multiSelect, setMultiSelect] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() =>
        setError("Connect your Freighter wallet to view your dashboard."),
      );
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    const fetchInvoices = async () => {
      setLoading(true);
      const results: Invoice[] = [];
      for (let id = 1; id <= 50; id++) {
        try {
          const inv = await splitClient.getInvoice(String(id));
          const isCreator = inv.creator === publicKey;
          const isRecipient = inv.recipients.some(
            (r) => r.address === publicKey,
          );
                    className={`w-full text-left rounded-xl ring-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        } catch {
          break;
        }
      }
      setInvoices(results);
      setLoading(false);
    };

    fetchInvoices().catch((e) => {
      setError(String(e));
      setLoading(false);
    });
  }, [publicKey]);

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

  // Numeric lookup with 300ms debounce (handled by InvoiceSearch), but we still trigger the fetch
  // in response to numeric searches by watching searchValue.
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

    // Debounce is implemented in InvoiceSearch; we still guard by delaying here to ensure
    // we align with the 300ms behavior.
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

  const pendingInvoices = invoices.filter((inv) => inv.status === "Pending");
  const selectedInvoices = invoices.filter((inv) => selected.has(inv.id));

  if (error) {
    return (
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-20 text-center overflow-x-hidden">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="flex items-center justify-between mb-10 flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2 flex-wrap">
          {!multiSelect && pendingInvoices.length > 0 && (
            <button
              onClick={() => setMultiSelect(true)}
              className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Enter multi-select mode to pay multiple invoices"
            >
              Pay Multiple
            </button>
          )}
          {multiSelect && (
            <>
              <button
                onClick={exitMultiSelect}
                className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowBatchModal(true)}
                disabled={selected.size === 0}
                className="min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={`Pay ${selected.size} selected invoice${selected.size !== 1 ? "s" : ""}`}
              >
                Pay Selected ({selected.size})
              </button>
            </>
          )}
          <Link
            href="/invoice/new"
            className="min-h-11 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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

      {loading ? (
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
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
                  >
                    <InvoiceCard invoice={inv} />
                  </Link>
                )}
              </li>
            );
          })}
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
    </main>
  );
}
