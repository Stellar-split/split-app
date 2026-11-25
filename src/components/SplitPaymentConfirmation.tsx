'use client';

import React from 'react';
import type {
  SplitPaymentConfirmation as SplitConfirmationType,
  SplitPaymentResult,
  SplitPaymentStatus,
} from '@/types/splitPayment';

export interface SplitPaymentConfirmationProps {
  confirmation: SplitConfirmationType;
  result?: SplitPaymentResult | null;
  status: SplitPaymentStatus;
  isExecuting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onReset?: () => void;
}

export const SplitPaymentConfirmationModal: React.FC<SplitPaymentConfirmationProps> = ({
  confirmation,
  result,
  status,
  isExecuting,
  onConfirm,
  onCancel,
  onReset,
}) => {
  const { request, derivedLines, rules, allRulesPassed, totalGross, totalNet, totalTax, totalFees } = confirmation;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="split-confirmation-title"
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-6"
    >
      <div>
        <h2 id="split-confirmation-title" className="text-xl font-bold text-white">
          Confirm Split Payment
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Review distribution rules and recipient allocations before executing payment.
        </p>
      </div>

      {/* Rules Validation Section */}
      <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/60 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Rule Validations
        </h3>
        <div className="space-y-1.5" data-testid="rule-validation-list">
          {rules.map((rule, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-300">{rule.description}</span>
              <span
                data-testid={`rule-status-${rule.type}`}
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  rule.passed
                    ? 'bg-green-950 text-green-400 border border-green-800'
                    : 'bg-red-950 text-red-400 border border-red-800'
                }`}
              >
                {rule.passed ? 'Passed' : 'Failed'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recipient Distribution Table */}
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-800/80 text-xs uppercase text-gray-400 border-b border-gray-700">
            <tr>
              <th className="px-4 py-2.5">Recipient</th>
              <th className="px-4 py-2.5">Share</th>
              <th className="px-4 py-2.5">Net Amount</th>
              {result && <th className="px-4 py-2.5">Status</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 font-mono text-xs">
            {derivedLines.map((line, idx) => {
              const res = result?.recipientResults.find((r) => r.address === line.address);
              return (
                <tr key={idx} className="hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 truncate max-w-[180px]" title={line.address}>
                    {line.address}
                  </td>
                  <td className="px-4 py-2.5">{line.sharePercent}%</td>
                  <td className="px-4 py-2.5 text-indigo-400">
                    {line.netAmount.toFixed(7)} {request.assetCode}
                  </td>
                  {result && (
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-sans font-semibold ${
                          res?.status === 'succeeded'
                            ? 'bg-green-900/60 text-green-300'
                            : res?.status === 'failed'
                            ? 'bg-red-900/60 text-red-300'
                            : 'bg-yellow-900/60 text-yellow-300'
                        }`}
                      >
                        {res?.status ?? 'Pending'}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals Summary */}
      <div className="bg-gray-800/40 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div>
          <span className="text-gray-400 block">Gross Total</span>
          <span className="text-gray-200 font-mono font-semibold">
            {totalGross.toFixed(7)} {request.assetCode}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block">Tax Withheld</span>
          <span className="text-orange-400 font-mono font-semibold">
            {totalTax.toFixed(7)} {request.assetCode}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block">Fees</span>
          <span className="text-red-400 font-mono font-semibold">
            {totalFees.toFixed(7)} {request.assetCode}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block">Net Distributed</span>
          <span className="text-emerald-400 font-mono font-semibold">
            {totalNet.toFixed(7)} {request.assetCode}
          </span>
        </div>
      </div>

      {/* Status / Results Notification */}
      {status === 'completed' && (
        <div
          role="status"
          className="p-3 bg-green-950/60 border border-green-800 rounded-lg text-sm text-green-300"
        >
          All {result?.successCount} recipient payments distributed successfully!
        </div>
      )}

      {status === 'partial_failure' && (
        <div
          role="alert"
          className="p-3 bg-yellow-950/60 border border-yellow-800 rounded-lg text-sm text-yellow-300"
        >
          {result?.error}
        </div>
      )}

      {status === 'failed' && (
        <div
          role="alert"
          className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-sm text-red-300"
        >
          {result?.error || 'Split payment failed to execute.'}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
        {status === 'completed' || status === 'partial_failure' || status === 'failed' ? (
          <button
            type="button"
            onClick={onReset ?? onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            Close
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onCancel}
              disabled={isExecuting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!allRulesPassed || isExecuting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExecuting ? 'Distributing...' : 'Confirm & Execute'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
