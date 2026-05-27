"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import InvoiceCard from "@/components/InvoiceCard";
import type { Invoice } from "@stellar-split/sdk";

/**
 * Dashboard — lists invoices where the connected wallet is creator or recipient.
 */
export default function DashboardPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() => setError("Connect your Freighter wallet to view your dashboard."));
  }, []);

  useEffect(() => {
    if (!publicKey) return;

    // Fetch invoices 1–50 and filter by creator or recipient.
    // In production this would use an indexer; here we scan a range.
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
          // Invoice doesn't exist — stop scanning.
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

  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <Link
          href="/invoice/new"
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors text-white"
        >
          + New Invoice
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-600 dark:text-gray-400">Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No invoices found. Create your first one!</p>
      ) : (
        <div className="flex flex-col gap-4">
          {invoices.map((inv) => (
            <Link key={inv.id} href={`/invoice/${inv.id}`}>
              <InvoiceCard invoice={inv} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
