'use client';

import { useEffect, useState } from 'react';
import { formatAmount } from '@stellar-split/sdk';
import { payMilestone } from '@/lib/stellar';
import type { Invoice } from '@stellar-split/sdk';

export interface InstallmentMilestone {
  id: string;
  amount: number;
  dueDate: number;
  status: 'upcoming' | 'overdue' | 'paid';
  txHash?: string;
}

interface Props {
  invoice: Invoice;
  installments: InstallmentMilestone[];
  publicKey: string;
  onPaid?: (milestoneId: string, txHash: string) => void;
}

type MilestoneStatus = 'paid' | 'pending' | 'overdue';

function getMilestoneStatus(m: InstallmentMilestone, now: number): MilestoneStatus {
  if (m.status === 'paid') return 'paid';
  if (m.dueDate < now) return 'overdue';
  return 'pending';
}

export default function InvoiceView({ invoice, installments, publicKey, onPaid }: Props) {
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localMilestones, setLocalMilestones] = useState<InstallmentMilestone[]>(installments);

  useEffect(() => {
    setLocalMilestones(installments);
  }, [installments]);

  const now = Math.floor(Date.now() / 1000);
  const hasOverdue = localMilestones.some((m) => getMilestoneStatus(m, now) === 'overdue');

  const handlePay = async (milestone: InstallmentMilestone) => {
    if (!publicKey || payingId) return;
    setPayingId(milestone.id);
    setError(null);
    try {
      const result = await payMilestone({
        payer: publicKey,
        invoiceId: invoice.id,
        amount: BigInt(Math.round(milestone.amount * 1e7)),
        milestoneId: milestone.id,
      });
      setLocalMilestones((prev) =>
        prev.map((m) =>
          m.id === milestone.id ? { ...m, status: 'paid' as const, txHash: result.txHash } : m
        )
      );
      onPaid?.(milestone.id, result.txHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPayingId(null);
    }
  };

  if (!localMilestones || localMilestones.length === 0) return null;

  return (
    <section className="mb-8" aria-labelledby="installment-timeline">
      <div className="flex items-center justify-between mb-4">
        <h2 id="installment-timeline" className="text-lg font-semibold text-white">Installment Schedule</h2>
        {hasOverdue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold px-2 py-0.5">
            Overdue
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-sm mb-4 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {localMilestones.map((m, idx) => {
          const status = getMilestoneStatus(m, now);
          const isPaid = status === 'paid';
          const isOverdue = status === 'overdue';

          const badge = isPaid
            ? { label: 'Paid', className: 'bg-green-500/20 text-green-400 border-green-700' }
            : isOverdue
            ? { label: 'Overdue', className: 'bg-red-500/20 text-red-400 border-red-700' }
            : { label: 'Upcoming', className: 'bg-gray-700/40 text-gray-300 border-gray-700' };

          return (
            <div
              key={m.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                isPaid
                  ? 'border-green-700 bg-green-950/40'
                  : isOverdue
                  ? 'border-red-700 bg-red-950/40'
                  : 'border-gray-700 bg-gray-800/60'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    isPaid ? 'bg-green-600 text-white' : isOverdue ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}>
                    {idx + 1}
                  </span>
                  {idx < localMilestones.length - 1 && (
                    <span className="w-px h-6 bg-gray-700 mt-1" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-200">
                      {new Date(m.dueDate * 1000).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className={`inline-flex items-center rounded-full border text-xs font-semibold px-2 py-0.5 ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  {isPaid && m.txHash && (
                    <p className="text-xs text-gray-500 mt-0.5">Tx: {m.txHash.slice(0, 12)}…</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pl-9 sm:pl-0">
                <span className={`text-sm font-semibold ${isPaid ? 'text-green-300' : isOverdue ? 'text-red-300' : 'text-indigo-300'}`}>
                  {formatAmount(BigInt(Math.round(m.amount * 1e7)))} USDC
                </span>
                {!isPaid && publicKey && (
                  <button
                    type="button"
                    onClick={() => handlePay(m)}
                    disabled={payingId === m.id}
                    className="min-h-10 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {payingId === m.id ? 'Paying…' : `Pay ${formatAmount(BigInt(Math.round(m.amount * 1e7)))} USDC`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
