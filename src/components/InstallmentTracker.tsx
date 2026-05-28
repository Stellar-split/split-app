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
 * InstallmentTracker — shows payer's installment progress with overall completion bar.
 * Highlights next due installment and provides "Pay Now" button.
 */
export default function InstallmentTracker({ invoice, publicKey, onPayNow }: Props) {
  const [installments, setInstallments] = useState<Installment[] | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
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
                    {isPaid ? 'Paid' : isNext ? 'Next due' : isPast ? 'Overdue' : 'Upcoming'}
                  </p>
                </div>
              </div>
              <span
                className={`flex-shrink-0 font-semibold ${
                  isNext ? 'text-indigo-300' : isPaid ? 'text-green-300' : 'text-gray-400'
                }`}
              >
                {formatAmount(inst.amount)} USDC
              </span>
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
  );
}
