"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { deadlineFromDays, parseAmount } from "@stellar-split/sdk";
import RecipientForm from "@/components/RecipientForm";
import TxConfirmModal from "@/components/TxConfirmModal";

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
  const [recurring, setRecurring] = useState(false);
  const [intervalDays, setIntervalDays] = useState<7 | 30>(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txModal, setTxModal] = useState<{ txHash: string; invoiceId: string } | null>(null);
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

      const { invoiceId, txHash } = await splitClient.createInvoice({
        creator,
        recipients: recipients.map((r) => ({
          address: r.address,
          amount: parseAmount(equalSplit ? (perRecipientAmount ?? "0") : r.amount),
        })),
        token,
        deadline: deadlineFromDays(deadlineDays),
        ...(recurring && { recurring, intervalDays }),
      });

      setTxModal({ txHash, invoiceId });
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      {txModal && (
        <TxConfirmModal
          txHash={txModal.txHash}
          action="Invoice created"
          onClose={() => router.push(`/invoice/${txModal.invoiceId}`)}
        />
      )}
      <h1 className="text-3xl font-bold mb-8">Create Invoice</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" aria-label="Create invoice form">
        {/* Equal Split toggle */}
        <div className="flex items-center justify-between rounded-lg bg-gray-800 border border-gray-700 px-4 py-3">
          <label htmlFor="equal-split-toggle" className="text-sm font-medium text-gray-300 cursor-pointer">
            Equal Split
          </label>
          <button
            id="equal-split-toggle"
            type="button"
            role="switch"
            aria-checked={equalSplit}
            aria-label="Toggle equal split mode"
            onClick={() => setEqualSplit((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              equalSplit ? "bg-indigo-600" : "bg-gray-600"
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
            <label htmlFor="total-amount" className="block text-sm font-medium text-gray-300 mb-1">
              Total Amount (USDC)
            </label>
            <input
              id="total-amount"
              type="number"
              placeholder="0.00"
              step="0.0000001"
              min="0.0000001"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
              className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {perRecipientAmount && (
              <p className="mt-1 text-xs text-gray-400">
                {perRecipientAmount} USDC per recipient
              </p>
            )}
          </div>
        )}

        {/* Recipients */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
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
          <label htmlFor="token-address" className="block text-sm font-medium text-gray-300 mb-1">
            USDC Token Contract Address
          </label>
          <input
            id="token-address"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            placeholder="C..."
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Deadline */}
        <div>
          <label htmlFor="deadline-days" className="block text-sm font-medium text-gray-300 mb-1">
            Deadline (days from now)
          </label>
          <input
            id="deadline-days"
            type="number"
            min={1}
            max={365}
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(Number(e.target.value))}
            required
            className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create Invoice"}
        </button>
      </form>
    </main>
  );
}
