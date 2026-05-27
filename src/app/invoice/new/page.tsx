"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { deadlineFromDays, parseAmount } from "@stellar-split/sdk";
import RecipientForm from "@/components/RecipientForm";

interface RecipientRow {
  address: string;
  amount: string; // human-readable USDC
}

/**
 * New Invoice page — form to create an on-chain StellarSplit invoice.
 */
export default function NewInvoicePage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { address: "", amount: "" },
  ]);
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [token, setToken] = useState(
    process.env.NEXT_PUBLIC_USDC_ADDRESS ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equalSplit, setEqualSplit] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");

  const perRecipientAmount =
    equalSplit && totalAmount && recipients.length > 0
      ? (parseFloat(totalAmount) / recipients.length).toFixed(7)
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const creator = await getFreighterPublicKey();

      const { invoiceId } = await splitClient.createInvoice({
        creator,
        recipients: recipients.map((r) => ({
          address: r.address,
          amount: parseAmount(equalSplit ? (perRecipientAmount ?? "0") : r.amount),
        })),
        token,
        deadline: deadlineFromDays(deadlineDays),
      });

      router.push(`/invoice/${invoiceId}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Create Invoice</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Equal Split toggle */}
        <div className="flex items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Equal Split</span>
          <button
            type="button"
            role="switch"
            aria-checked={equalSplit}
            onClick={() => setEqualSplit((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              equalSplit ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                equalSplit ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Total amount input (equal split mode) */}
        {equalSplit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Amount (USDC)
            </label>
            <input
              type="number"
              placeholder="0.00"
              step="0.0000001"
              min="0.0000001"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-100"
            />
            {perRecipientAmount && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {perRecipientAmount} USDC per recipient
              </p>
            )}
          </div>
        )}

        {/* Recipients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recipients {equalSplit ? "" : "& Amounts (USDC)"}
          </label>
          <RecipientForm
            recipients={recipients}
            onChange={setRecipients}
            equalSplit={equalSplit}
            amountOverride={perRecipientAmount}
          />
        </div>

        {/* Token address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            USDC Token Contract Address
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            placeholder="C..."
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Deadline (days from now)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(Number(e.target.value))}
            required
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-100"
          />
        </div>

        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50 text-white"
        >
          {submitting ? "Creating…" : "Create Invoice"}
        </button>
      </form>
    </main>
  );
}