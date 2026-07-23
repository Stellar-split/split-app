"use client";

import { useState } from "react";
import { splitClient, payWithNonce } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { parseAmount } from "@stellar-split/sdk";
import BatchPayQueue from "@/components/BatchPayQueue";
import type { Invoice } from "@stellar-split/sdk";

interface QueueEntry {
  invoice: Invoice;
  amount: string;
}

const STELLAR_EXPERT_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

export default function BatchPayPage() {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const invoiceId = search.trim();
    if (!invoiceId) return;
    if (queue.some((entry) => entry.invoice.id === invoiceId)) {
      setSearchError("Invoice already in queue.");
      return;
    }
    setSearchError(null);
    setSearching(true);
    try {
      const invoice = await splitClient.getInvoice(invoiceId);
      if (invoice.status !== "Pending") {
        setSearchError(`Invoice #${invoiceId} is ${invoice.status} and cannot be paid.`);
        return;
      }
      setQueue((prev) => [...prev, { invoice, amount: "" }]);
      setSearch("");
    } catch (err) {
      setSearchError(`Invoice not found: ${err}`);
    } finally {
      setSearching(false);
    }
  };

  const handleAmountChange = (invoiceId: string, value: string) => {
    setQueue((prev) =>
      prev.map((e) => (e.invoice.id === invoiceId ? { ...e, amount: value } : e))
    );
  };

  const handleRemove = (invoiceId: string) => {
    setQueue((prev) => prev.filter((e) => e.invoice.id !== invoiceId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setTxHash(null);

    const pairs = queue
      .filter((entry) => entry.amount && parseFloat(entry.amount) > 0)
      .map((entry) => ({ invoiceId: entry.invoice.id, amount: parseAmount(entry.amount) }));

    if (pairs.length === 0) {
      setSubmitError("Enter an amount for at least one invoice.");
      return;
    }

    setSubmitting(true);
    try {
      const publicKey = await getFreighterPublicKey();

      let lastTxHash = "";
      if (typeof (splitClient as any).batchPay === "function") {
        const result = await (splitClient as any).batchPay(
          pairs.map((p) => ({ ...p, payer: publicKey }))
        );
        lastTxHash = result.txHash;
      } else {
        for (const pair of pairs) {
          const result = await payWithNonce({
            payer: publicKey,
            invoiceId: pair.invoiceId,
            amount: pair.amount,
          });
          lastTxHash = result.txHash;
        }
      }

      setTxHash(lastTxHash);
      setQueue([]);
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Batch Pay</h1>
      <p className="text-gray-400 text-sm mb-8">
        Add multiple invoices to a payment queue and pay them all in one submission.
      </p>

      {/* Invoice search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <label htmlFor="invoice-search" className="sr-only">Invoice ID</label>
        <input
          id="invoice-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Enter invoice ID…"
          className="flex-1 min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-describedby={searchError ? "search-error" : undefined}
        />
        <button
          type="submit"
          disabled={searching || !search.trim()}
          className="min-h-11 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
        >
          {searching ? "Searching…" : "Add"}
        </button>
      </form>

      {searchError && (
        <p id="search-error" role="alert" className="text-red-400 text-sm mb-4">
          {searchError}
        </p>
      )}

      {/* Queue */}
      <section aria-labelledby="queue-heading" className="mb-8">
        <h2 id="queue-heading" className="text-lg font-semibold mb-3">
          Payment Queue ({queue.length})
        </h2>
        <BatchPayQueue
          queue={queue}
          onAmountChange={handleAmountChange}
          onRemove={handleRemove}
        />
      </section>

      {/* Submit */}
      {queue.length > 0 && (
        <form onSubmit={handleSubmit}>
          {submitError && (
            <p role="alert" className="text-red-400 text-sm mb-3">{submitError}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting…" : `Pay ${queue.length} Invoice${queue.length > 1 ? "s" : ""}`}
          </button>
        </form>
      )}

      {txHash && (
        <div
          role="status"
          className="mt-6 p-4 rounded-xl bg-green-950/50 border border-green-500/30 text-sm"
        >
          <p className="font-semibold text-green-400 mb-1">All payments submitted!</p>
          <p className="text-gray-400 text-xs font-mono break-all mb-2">Tx: {txHash}</p>
          <a
            href={`${STELLAR_EXPERT_BASE}/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 text-xs underline"
          >
            View Transaction
          </a>
        </div>
      )}
    </main>
  );
}
