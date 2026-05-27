"use client";

import { useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { deadlineFromDays, parseAmount } from "@stellar-split/sdk";
import RecipientForm from "@/components/RecipientForm";

interface RecipientRow {
  address: string;
  amount: string;
}

interface InvoiceRow {
  recipients: RecipientRow[];
  deadlineDays: number;
}

const MAX_ROWS = 5;

function emptyRow(): InvoiceRow {
  return { recipients: [{ address: "", amount: "" }], deadlineDays: 7 };
}

/**
 * Batch invoice creation — up to 5 invoices submitted in one action.
 */
export default function BatchInvoicePage() {
  const [rows, setRows] = useState<InvoiceRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const token = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

  const updateRow = (i: number, patch: Partial<InvoiceRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const creator = await getFreighterPublicKey();
      const params = rows.map((row) => ({
        creator,
        recipients: row.recipients.map((r) => ({
          address: r.address,
          amount: parseAmount(r.amount),
        })),
        token,
        deadline: deadlineFromDays(row.deadlineDays),
      }));

      // splitClient.createBatch — sequential fallback if not available
      const ids: string[] = [];
      if (typeof (splitClient as any).createBatch === "function") {
        const results = await (splitClient as any).createBatch(params);
        ids.push(...results.map((r: any) => r.invoiceId));
      } else {
        for (const p of params) {
          const { invoiceId } = await splitClient.createInvoice(p);
          ids.push(invoiceId);
        }
      }
      setCreatedIds(ids);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (createdIds.length > 0) {
    return (
      <main className="max-w-xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
        <h1 className="text-3xl font-bold mb-6">Batch Created!</h1>
        <ul className="flex flex-col gap-2">
          {createdIds.map((id) => (
            <li key={id}>
              <a
                href={`/invoice/${id}`}
                className="text-indigo-400 hover:underline text-sm"
              >
                Invoice #{id}
              </a>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <h1 className="text-3xl font-bold mb-2">Batch Invoice Creation</h1>
      <p className="text-gray-400 text-sm mb-8">
        Create up to {MAX_ROWS} invoices at once.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {rows.map((row, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-200">Invoice {i + 1}</h2>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recipients &amp; Amounts (USDC)
              </label>
              <RecipientForm
                recipients={row.recipients}
                onChange={(recipients) => updateRow(i, { recipients })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Deadline (days from now)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={row.deadlineDays}
                onChange={(e) => updateRow(i, { deadlineDays: Number(e.target.value) })}
                required
                className="w-full sm:w-32 min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        ))}

        {rows.length < MAX_ROWS && (
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            className="self-start min-h-11 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
          >
            + Add Invoice
          </button>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? `Creating ${rows.length} invoice${rows.length > 1 ? "s" : ""}…` : `Create ${rows.length} Invoice${rows.length > 1 ? "s" : ""}`}
        </button>
      </form>
    </main>
  );
}
