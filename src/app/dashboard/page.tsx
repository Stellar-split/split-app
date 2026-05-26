"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import InvoiceCard from "@/components/InvoiceCard";
import type { Invoice, InvoiceStatus } from "@stellar-split/sdk";

type StatusTab = "All" | InvoiceStatus;
type SortKey = "date" | "amount";
type SortDir = "asc" | "desc";

const STATUS_TABS: StatusTab[] = ["All", "Pending", "Released", "Refunded"];

function invoiceTotal(inv: Invoice): bigint {
  return inv.recipients.reduce((s, r) => s + r.amount, 0n);
}

/**
 * Dashboard — lists invoices where the connected wallet is creator or recipient.
 */
export default function DashboardPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>("All");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setError("Connect your Freighter wallet to view your dashboard."));
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
          const isRecipient = inv.recipients.some((r) => r.address === publicKey);
          if (isCreator || isRecipient) results.push(inv);
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

  const filteredInvoices = useMemo(() => {
    let list = invoices;

    if (statusTab !== "All") {
      list = list.filter((inv) => inv.status === statusTab);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (inv) =>
          inv.id.toLowerCase().includes(q) ||
          inv.recipients.some((r) => r.address.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") {
        cmp = a.deadline - b.deadline;
      } else {
        const totalA = invoiceTotal(a);
        const totalB = invoiceTotal(b);
        cmp = totalA < totalB ? -1 : totalA > totalB ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [invoices, statusTab, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortBtnClass = (key: SortKey) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      sortKey === key
        ? "bg-indigo-600 text-white"
        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
    }`;

  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <Link
          href="/invoice/new"
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors shrink-0"
        >
          + New Invoice
        </Link>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <input
          type="search"
          placeholder="Search by invoice ID or address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                statusTab === tab
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggleSort("date")}
            className={sortBtnClass("date")}
          >
            Date {sortKey === "date" && (sortDir === "asc" ? "↑" : "↓")}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("amount")}
            className={sortBtnClass("amount")}
          >
            Amount {sortKey === "amount" && (sortDir === "asc" ? "↑" : "↓")}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading invoices…</p>
      ) : filteredInvoices.length === 0 ? (
        <p className="text-gray-400">
          {invoices.length === 0
            ? "No invoices found. Create your first one!"
            : "No invoices match your filters."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredInvoices.map((inv) => (
            <Link key={inv.id} href={`/invoice/${inv.id}`}>
              <InvoiceCard invoice={inv} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
