"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { formatAmount } from "@stellar-split/sdk";
import InvoiceCard from "@/components/InvoiceCard";
import { SkeletonCard } from "@/components/Skeleton";
import type { Invoice } from "@stellar-split/sdk";

/**
 * Recipient portal — shows all invoices where the connected wallet is a recipient.
 */
export default function RecipientPage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFreighterPublicKey()
      .then(setPublicKey)
      .catch(() =>
        setError("Connect your Freighter wallet to view recipient invoices."),
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
          const isRecipient = inv.recipients.some(
            (r) => r.address === publicKey,
          );
          if (isRecipient) results.push(inv);
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

  if (error) {
    return (
      <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-20 text-center overflow-x-hidden">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <h1 className="text-3xl font-bold mb-10">Recipient Invoices</h1>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">
            No invoices where you are a recipient yet.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Recipient invoice list">
          {invoices.map((inv) => {
            const recipientAmount = inv.recipients.find(
              (r) => r.address === publicKey,
            )?.amount ?? 0n;
            const total = inv.recipients.reduce((s, r) => s + r.amount, 0n);
            const fundedPercent =
              total > 0n ? Number((inv.funded * 100n) / total) : 0;
            const isReleased = inv.status === "Released";

            return (
              <li key={inv.id}>
                <Link
                  href={`/invoice/${inv.id}`}
                  aria-label={`View Invoice #${inv.id}`}
                  className="block"
                >
                  <div className="bg-gray-900 rounded-xl p-4 sm:p-5 hover:bg-gray-800 transition-colors cursor-pointer">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="text-sm font-semibold text-gray-300">
                        Invoice #{inv.id}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                            isReleased
                              ? "bg-green-500/20 text-green-300"
                              : "bg-yellow-500/20 text-yellow-300"
                          }`}
                        >
                          {inv.status}
                        </span>
                        {isReleased && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 shrink-0">
                            Claimable
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-400 mb-1">
                        Your owed amount
                      </p>
                      <p className="text-lg font-semibold text-indigo-300">
                        {formatAmount(recipientAmount)} USDC
                      </p>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Funding progress</span>
                        <span>{fundedPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${fundedPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
                      <span>
                        Due{" "}
                        {new Date(inv.deadline * 1000).toLocaleDateString()}
                      </span>
                      <span>{formatAmount(inv.funded)} USDC funded</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
