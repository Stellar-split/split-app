"use client";

import { useEffect, useState } from "react";
import { splitClient } from "@/lib/stellar";
import { formatAmount } from "@stellar-split/sdk";

interface Installment {
  dueDate: number; // unix timestamp (seconds)
  amount: bigint;
  paid: boolean;
}

interface Props {
  invoiceId: string;
  publicKey: string;
}

/**
 * InstallmentPanel — shows the payer's installment schedule for an invoice.
 * Highlights the next due installment; marks past ones as paid if payment exists.
 */
export default function InstallmentPanel({ invoiceId, publicKey }: Props) {
  const [installments, setInstallments] = useState<Installment[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (splitClient as any)
      .getInstallmentPlan(invoiceId, publicKey)
      .then((plan: Installment[] | null) => setInstallments(plan ?? []))
      .catch(() => setInstallments([]))
      .finally(() => setLoading(false));
  }, [invoiceId, publicKey]);

  if (loading) return null;

  if (!installments || installments.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Installment Schedule</h2>
        <p className="text-sm text-gray-400">No plan registered.</p>
      </section>
    );
  }

  const now = Date.now() / 1000;
  const nextDueIndex = installments.findIndex((inst) => !inst.paid && inst.dueDate >= now);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">Installment Schedule</h2>
      <ol className="flex flex-col gap-2">
        {installments.map((inst, i) => {
          const isNext = i === nextDueIndex;
          const isPast = inst.paid || (!isNext && inst.dueDate < now);
          return (
            <li
              key={i}
              className={`flex items-center justify-between rounded-lg px-4 py-2 text-sm border ${
                isNext
                  ? "border-indigo-500 bg-indigo-950"
                  : isPast
                  ? "border-gray-700 bg-gray-900 opacity-60"
                  : "border-gray-700 bg-gray-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {inst.paid ? (
                  <span className="text-green-400 text-xs font-semibold">✓ Paid</span>
                ) : isNext ? (
                  <span className="text-indigo-300 text-xs font-semibold">Next due</span>
                ) : (
                  <span className="text-gray-500 text-xs">#{i + 1}</span>
                )}
                <span className="text-gray-300">
                  {new Date(inst.dueDate * 1000).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <span className={isNext ? "text-indigo-300 font-semibold" : "text-gray-400"}>
                {formatAmount(inst.amount)} USDC
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
