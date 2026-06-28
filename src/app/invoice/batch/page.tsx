"use client";

import { useState } from "react";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import { deadlineFromDays, parseAmount } from "@stellar-split/sdk";
import RecipientForm from "@/components/RecipientForm";
import { recordInvoiceHistory } from "@/lib/invoiceHistory";

interface RecipientRow {
  address: string;
  amount: string;
}

interface InvoiceRow {
  recipients: RecipientRow[];
  deadlineDays: number;
}

export interface DuplicateGroup {
  recipient: string;
  amount: string;
  rowNumbers: number[];
}

export function findBatchDuplicates(rows: InvoiceRow[]): DuplicateGroup[] {
  const seen = new Map<string, number[]>();
  rows.forEach((row, rowIdx) => {
    row.recipients.forEach((r) => {
      if (!r.address.trim() || !r.amount.trim()) return;
      const key = `${r.address.trim().toLowerCase()}|${r.amount.trim()}`;
      const existing = seen.get(key);
      if (existing) {
        existing.push(rowIdx + 1);
      } else {
        seen.set(key, [rowIdx + 1]);
      }
    });
  });
  const duplicates: DuplicateGroup[] = [];
  for (const [key, rowNumbers] of seen) {
    if (rowNumbers.length > 1) {
      const [recipient, amount] = key.split("|");
      duplicates.push({ recipient, amount, rowNumbers });
    }
  }
  return duplicates;
}

const MAX_ROWS = 5;

function emptyRow(): InvoiceRow {
  return { recipients: [{ address: "", amount: "" }], deadlineDays: 7 };
}

export default function BatchInvoicePage() {
  const [rows, setRows] = useState<InvoiceRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateGroup[] | null>(null);

  const token = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";

  const updateRow = (i: number, patch: Partial<InvoiceRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submitBatch = async () => {
    setError(null);
    setSubmitting(true);
    setDuplicateWarning(null);
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
      // as any: createBatch is not yet declared in the published @stellar-split/sdk types
      if (typeof (splitClient as any).createBatch === "function") {
        // as any: createBatch is not yet declared in the published @stellar-split/sdk types
        const results = await (splitClient as any).createBatch(params);
        ids.push(...results.map((r: any) => r.invoiceId));
      } else {
        for (const p of params) {
          const { invoiceId } = await splitClient.createInvoice(p);
          ids.push(invoiceId);
        }
      }
      recordInvoiceHistory(
        rows.flatMap((row) =>
          row.recipients.map((recipient) => ({
            address: recipient.address,
            amount: recipient.amount,
          }))
        )
      );
      setCreatedIds(ids);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dupes = findBatchDuplicates(rows);
    if (dupes.length > 0) {
      setDuplicateWarning(dupes);
      return;
    }
    await submitBatch();
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

        {duplicateWarning && (
          <div className="bg-amber-950/60 border border-amber-700 rounded-xl p-4" role="alert">
            <h3 className="text-amber-300 font-semibold mb-2">Duplicate entries detected</h3>
            <ul className="text-sm text-amber-200 mb-4 flex flex-col gap-1">
              {duplicateWarning.map((d, i) => (
                <li key={i}>
                  Rows {d.rowNumbers.join(", ")}: {d.recipient.length > 16 ? d.recipient.slice(0, 8) + "…" + d.recipient.slice(-4) : d.recipient} — {d.amount} USDC
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => submitBatch()}
                disabled={submitting}
                className="min-h-11 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Submit anyway"}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
              >
                Go back and fix
              </button>
            </div>
          </div>
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
