"use client";

import { useEffect, useRef, useState } from "react";
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
  /** #614: when total changes, amounts are recalculated proportionally */
  total?: bigint;
}

/**
 * #614 — recalculate installment amounts proportionally when `total` changes.
 *
 * The proportion of each installment is derived from the original fetched plan.
 * Rounding remainders are applied to the last installment.
 * A brief "Updated" badge flashes after each recalculation.
 */
function recalcAmounts(original: Installment[], newTotal: bigint): Installment[] {
  if (original.length === 0) return original;

  const originalTotal = original.reduce((s, i) => s + i.amount, 0n);
  if (originalTotal === 0n) return original;

  // Calculate proportional amounts; keep track of distributed sum to fix rounding
  const recalculated: Installment[] = original.map((inst) => ({
    ...inst,
    amount: (inst.amount * newTotal) / originalTotal,
  }));

  // Assign rounding remainder to the last installment
  const distributed = recalculated.reduce((s, i) => s + i.amount, 0n);
  const remainder = newTotal - distributed;
  if (remainder !== 0n) {
    const last = recalculated[recalculated.length - 1];
    recalculated[recalculated.length - 1] = {
      ...last,
      amount: last.amount + remainder,
    };
  }

  return recalculated;
}

/**
 * InstallmentPanel — shows the payer's installment schedule for an invoice.
 * Highlights the next due installment; marks past ones as paid if payment exists.
 */
export default function InstallmentPanel({ invoiceId, publicKey, total }: Props) {
  const [baseInstallments, setBaseInstallments] = useState<Installment[] | null>(null);
  const [installments, setInstallments] = useState<Installment[] | null>(null);
  const [loading, setLoading] = useState(true);
  // #614: flash badge state
  const [showUpdated, setShowUpdated] = useState(false);
  const prevTotal = useRef<bigint | undefined>(undefined);

  // Fetch plan once on mount
  useEffect(() => {
    /* eslint-disable-next-line */
    (splitClient as any)
      .getInstallmentPlan(invoiceId, publicKey)
      .then((plan: Installment[] | null) => {
        const resolved = plan ?? [];
        setBaseInstallments(resolved);
        // Apply total immediately if provided
        if (total !== undefined && resolved.length > 0) {
          setInstallments(recalcAmounts(resolved, total));
        } else {
          setInstallments(resolved);
        }
        prevTotal.current = total;
      })
      .catch(() => {
        setBaseInstallments([]);
        setInstallments([]);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, publicKey]);

  // #614: recalculate whenever total prop changes after initial load
  useEffect(() => {
    if (
      baseInstallments === null ||
      baseInstallments.length === 0 ||
      total === undefined
    )
      return;

    // Skip the very first assignment (handled in the fetch effect)
    if (prevTotal.current === total) return;

    prevTotal.current = total;
    setInstallments(recalcAmounts(baseInstallments, total));

    // Flash "Updated" badge for 1.5 s
    setShowUpdated(true);
    const t = setTimeout(() => setShowUpdated(false), 1500);
    return () => clearTimeout(t);
  }, [total, baseInstallments]);

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
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold">Installment Schedule</h2>
        {/* #614: visual indicator after recalculation */}
        {showUpdated && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-700 text-indigo-100 animate-pulse">
            Updated
          </span>
        )}
      </div>
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
