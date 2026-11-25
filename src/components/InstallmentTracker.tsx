'use client';

import { useEffect, useState } from 'react';
import { splitClient } from '@/lib/stellar';
import { formatAmount } from '@stellar-split/sdk';
import PaymentProgress from './PaymentProgress';
import type { Invoice } from '@stellar-split/sdk';

interface Installment {
  dueDate: number;
  amount: bigint;
  paid: boolean;
}

interface Props {
  invoice: Invoice;
  publicKey: string;
  onPayNow?: (amount: bigint) => void;
}

/**
 * #615: MarkAsPaidDialog — confirmation dialog shown before marking an installment paid.
 */
interface MarkAsPaidDialogProps {
  index: number;
  amount: bigint;
  dueDate: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function MarkAsPaidDialog({
  index,
  amount,
  dueDate,
  onConfirm,
  onCancel,
  loading,
}: MarkAsPaidDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-paid-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
        <h2
          id="mark-paid-title"
          className="text-base font-semibold text-white mb-2"
        >
          Mark Installment #{index + 1} as Paid?
        </h2>
        <p className="text-sm text-gray-400 mb-1">
          Due:{' '}
          <span className="text-gray-200">
            {new Date(dueDate * 1000).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Amount:{' '}
          <span className="text-indigo-300 font-semibold">
            {formatAmount(amount)} USDC
          </span>
        </p>
        <p className="text-xs text-yellow-300 bg-yellow-900/30 border border-yellow-700 rounded px-3 py-2 mb-6">
          This will record the installment as paid via the invoices API. This
          action reflects an off-chain payment and cannot be undone automatically.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * InstallmentTracker — shows payer's installment progress with overall completion bar.
 * Highlights next due installment and provides "Pay Now" button.
 *
 * #615: Each unpaid installment row has a "Mark as Paid" button.
 * Clicking it opens a confirmation dialog before persisting the update.
 */
export default function InstallmentTracker({ invoice, publicKey, onPayNow }: Props) {
  const [installments, setInstallments] = useState<Installment[] | null>(null);
  const [loading, setLoading] = useState(true);

  // #615: dialog state
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (splitClient as any)
      .getInstallmentPlan(invoice.id, publicKey)
      .then((plan: Installment[] | null) => setInstallments(plan ?? []))
      .catch(() => setInstallments([]))
      .finally(() => setLoading(false));
  }, [invoice.id, publicKey]);

  if (loading || !installments || installments.length === 0) return null;

  const now = Date.now() / 1000;
  const paidCount = installments.filter((i) => i.paid).length;
  const totalCount = installments.length;
  const completionPct = Math.round((paidCount / totalCount) * 100);

  const nextDueIndex = installments.findIndex((inst) => !inst.paid && inst.dueDate >= now);
  const nextInstallment = nextDueIndex >= 0 ? installments[nextDueIndex] : null;

  // #615: persist mark-as-paid via API then optimistically update local state
  const handleConfirmMarkPaid = async () => {
    if (pendingIndex === null) return;
    setSaving(true);
    try {
      await fetch(
        `/api/invoices/${encodeURIComponent(invoice.id)}/installments/${pendingIndex}/mark-paid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-public-key': publicKey,
          },
        }
      );
      // Optimistic update: mark the installment as paid in local state
      setInstallments((prev) =>
        prev
          ? prev.map((inst, i) =>
              i === pendingIndex ? { ...inst, paid: true } : inst
            )
          : prev
      );
    } catch {
      // Silently fail — user can retry; do not leave dialog open
    } finally {
      setSaving(false);
      setPendingIndex(null);
    }
  };

  return (
    <>
      {/* #615: confirmation dialog (rendered outside card flow for z-index) */}
      {pendingIndex !== null && installments[pendingIndex] && (
        <MarkAsPaidDialog
          index={pendingIndex}
          amount={installments[pendingIndex].amount}
          dueDate={installments[pendingIndex].dueDate}
          onConfirm={handleConfirmMarkPaid}
          onCancel={() => setPendingIndex(null)}
          loading={saving}
        />
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Installment Progress</h2>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">
              {paidCount} of {totalCount} paid
            </span>
            <span className="text-sm font-semibold text-indigo-300">{completionPct}%</span>
          </div>
          <PaymentProgress
            funded={BigInt(paidCount) * (installments[0]?.amount ?? 0n)}
            total={installments.reduce((sum, i) => sum + i.amount, 0n)}
          />
        </div>

        <div className="space-y-2 mb-6">
          {installments.map((inst, i) => {
            const isNext = i === nextDueIndex;
            const isPaid = inst.paid;
            const isPast = !isPaid && inst.dueDate < now;

            return (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm border transition-colors ${
                  isNext
                    ? 'border-indigo-500 bg-indigo-950'
                    : isPaid
                    ? 'border-green-700 bg-green-950 opacity-70'
                    : isPast
                    ? 'border-red-700 bg-red-950 opacity-70'
                    : 'border-gray-700 bg-gray-900'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    {isPaid ? (
                      <span className="text-green-400 font-bold">✓</span>
                    ) : isNext ? (
                      <span className="text-indigo-300 font-bold">→</span>
                    ) : isPast ? (
                      <span className="text-red-400 font-bold">!</span>
                    ) : (
                      <span className="text-gray-500">•</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300">
                      {new Date(inst.dueDate * 1000).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isPaid ? (
                        // #615: "Paid" badge after marking
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-800 text-green-200 font-semibold">
                          ✓ Paid
                        </span>
                      ) : isNext ? (
                        'Next due'
                      ) : isPast ? (
                        'Overdue'
                      ) : (
                        'Upcoming'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`font-semibold ${
                      isNext ? 'text-indigo-300' : isPaid ? 'text-green-300' : 'text-gray-400'
                    }`}
                  >
                    {formatAmount(inst.amount)} USDC
                  </span>

                  {/* #615: Mark as Paid button — only shown for unpaid installments */}
                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => setPendingIndex(i)}
                      className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:border-green-500 hover:text-green-400 transition-colors"
                      aria-label={`Mark installment ${i + 1} as paid`}
                    >
                      Mark as Paid
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {nextInstallment && onPayNow && (
          <button
            onClick={() => onPayNow(nextInstallment.amount)}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-medium transition-colors"
          >
            Pay Next Installment ({formatAmount(nextInstallment.amount)} USDC)
          </button>
        )}
      </section>
    </>
  );
}
