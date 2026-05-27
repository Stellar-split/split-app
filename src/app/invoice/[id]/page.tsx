"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import PaymentProgress from "@/components/PaymentProgress";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  params: { id: string };
}

/**
 * Invoice detail page — shows status, payment progress, and a Pay button.
 */
export default function InvoiceDetailPage({ params }: Props) {
  const { id } = params;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const load = async () => {
    const inv = await splitClient.getInvoice(id);
    setInvoice(inv);
  };

  useEffect(() => {
    load().catch((e) => setError(String(e)));
    getFreighterPublicKey().then(setPublicKey).catch(() => null);
  }, [id]);

  const total = invoice
    ? invoice.recipients.reduce((s, r) => s + r.amount, 0n)
    : 0n;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !invoice) return;
    setError(null);
    setPaying(true);
    try {
      const result = await splitClient.pay({
        payer: publicKey,
        invoiceId: id,
        amount: parseAmount(payAmount),
      });
      setTxHash(result.txHash);
      await load();
    } catch (err) {
      setError(String(err));
    } finally {
      setPaying(false);
    }
  };

  if (error && !invoice) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-600 dark:text-gray-400">Loading invoice…</p>
      </main>
    );
  }

  const statusColor: Record<string, string> = {
    Pending: "bg-yellow-500",
    Released: "bg-green-500",
    Refunded: "bg-gray-500",
  };

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoice #{id}</h1>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white ${statusColor[invoice.status]}`}
        >
          {invoice.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <PaymentProgress funded={invoice.funded} total={total} />
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {formatAmount(invoice.funded)} / {formatAmount(total)} USDC funded
        </p>
      </div>

      {/* Recipients */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Recipients</h2>
        <ul className="flex flex-col gap-2">
          {invoice.recipients.map((r, i) => (
            <li
              key={i}
              className="flex justify-between bg-gray-100 dark:bg-gray-900 rounded-lg px-4 py-2 text-sm border border-gray-200 dark:border-gray-800"
            >
              <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                {r.address}
              </span>
              <span className="text-indigo-600 dark:text-indigo-300">{formatAmount(r.amount)} USDC</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Pay form */}
      {invoice.status === "Pending" && publicKey && (
        <form onSubmit={handlePay} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pay toward this invoice</h2>
          <input
            type="number"
            step="0.0000001"
            min="0.0000001"
            placeholder="Amount in USDC"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            required
            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-100"
          />
          {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
          {txHash && (
            <p className="text-green-600 dark:text-green-400 text-sm">
              Payment sent! Tx: {txHash.slice(0, 12)}…
            </p>
          )}
          <button
            type="submit"
            disabled={paying}
            className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50 text-white"
          >
            {paying ? "Sending…" : "Pay"}
          </button>
        </form>
      )}

      {invoice.status !== "Pending" && (
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          This invoice is {invoice.status.toLowerCase()} and no longer accepts payments.
        </p>
      )}
    </main>
  );
}