"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";
import { formatAmount } from "@stellar-split/sdk";
import StatusBadge from "@/components/StatusBadge";
import AmountDisplay from "@/components/invoice/AmountDisplay";

interface Props {
  recentIds: string[];
}

export default function RecentInvoicesPanel({ recentIds }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (recentIds.length === 0 || !open) return;

    setLoading(true);
    (async () => {
      const results: Invoice[] = [];
      for (const id of recentIds) {
        try {
          const inv = await splitClient.getInvoice(id);
          results.push(inv);
        } catch {
          // Invoice deleted — skip silently
        }
      }
      setInvoices(results);
      setLoading(false);
    })();
  }, [recentIds, open]);

  const handleClose = () => setOpen(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  if (recentIds.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Recent invoices"
        aria-pressed={open}
        title="Recently viewed invoices"
        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Recent Invoices</h2>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-gray-400">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No recent invoices</div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {invoices.map((inv) => {
                const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
                return (
                  <li key={inv.id}>
                    <Link
                      href={`/invoice/${inv.id}`}
                      onClick={handleClose}
                      className="block px-4 py-3 hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">
                          Invoice #{inv.id}
                        </span>
                        <StatusBadge status={inv.status as any} size="sm" />
                      </div>
                      <div className="text-xs text-gray-400">
                        <AmountDisplay amount={total} className="text-xs" /> USDC
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
