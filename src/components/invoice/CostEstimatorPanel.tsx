'use client';

import { type CostBreakdown } from '@/hooks/useInvoiceCostEstimate';

interface CostEstimatorPanelProps {
  breakdown: CostBreakdown;
  isBalanceSufficient: boolean | null;
  creatorBalance: number | null;
  invoiceAmountXlm: number;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

export default function CostEstimatorPanel({
  breakdown,
  isBalanceSufficient,
  creatorBalance,
  invoiceAmountXlm,
  loading = false,
  error = null,
  disabled = false,
}: CostEstimatorPanelProps) {
  const totalRequired = invoiceAmountXlm + breakdown.totalXlm;

  return (
    <div
      className={`p-4 rounded-lg border ${
        isBalanceSufficient === false
          ? 'bg-red-500/5 border-red-500/30'
          : 'bg-blue-500/5 border-blue-500/30'
      }`}
    >
      <h3 className="text-sm font-semibold text-gray-200 mb-4">Cost Estimate</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-sm">
          Loading cost estimate...
        </div>
      )}

      <div className="space-y-3">
        {/* Invoice Amount */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Invoice Amount</span>
          <span className="text-gray-200 font-medium">{invoiceAmountXlm.toFixed(2)} XLM</span>
        </div>

        {/* Network Fee */}
        {breakdown.networkFeeXlm > 0 && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Network Fee</span>
              <div className="group relative">
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-400"
                  aria-label="Network fee info"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 12a7 7 0 110-2h.01a7.003 7.003 0 0 1 0 2z"
                    />
                  </svg>
                </button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-gray-200 text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  Stellar network transaction fee
                </div>
              </div>
            </div>
            <span className="text-gray-200 font-medium">
              {breakdown.networkFeeXlm.toFixed(6)} XLM
            </span>
          </div>
        )}

        {/* Platform Fee */}
        {breakdown.platformFeeXlm > 0 && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Platform Fee</span>
              <div className="group relative">
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-400"
                  aria-label="Platform fee info"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 12a7 7 0 110-2h.01a7.003 7.003 0 0 1 0 2z"
                    />
                  </svg>
                </button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-gray-200 text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  StellarSplit service fee (1% minimum 0.1 XLM)
                </div>
              </div>
            </div>
            <span className="text-gray-200 font-medium">
              {breakdown.platformFeeXlm.toFixed(4)} XLM
            </span>
          </div>
        )}

        {/* Reserve Top-up */}
        {breakdown.reserveTopUpXlm > 0 && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Trustline Reserve</span>
              <div className="group relative">
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-400"
                  aria-label="Trustline reserve info"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 12a7 7 0 110-2h.01a7.003 7.003 0 0 1 0 2z"
                    />
                  </svg>
                </button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-gray-200 text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  Reserve for new trustlines (0.5 XLM each)
                </div>
              </div>
            </div>
            <span className="text-yellow-400 font-medium">
              {breakdown.reserveTopUpXlm.toFixed(4)} XLM
            </span>
          </div>
        )}

        {/* Add-on Costs */}
        {breakdown.addOnCostsXlm > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Add-on Features</span>
            <span className="text-gray-200 font-medium">
              {breakdown.addOnCostsXlm.toFixed(4)} XLM
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-700 my-2" />

        {/* Total */}
        <div className="flex justify-between items-center text-base">
          <span className="font-semibold text-gray-100">Total Required</span>
          <span className={`font-bold ${isBalanceSufficient === false ? 'text-red-400' : 'text-indigo-400'}`}>
            {totalRequired.toFixed(4)} XLM
          </span>
        </div>

        {/* Balance Status */}
        {creatorBalance !== null && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-gray-400">Your Balance</span>
              <span
                className={
                  isBalanceSufficient === false
                    ? 'text-red-400 font-medium'
                    : 'text-green-400 font-medium'
                }
              >
                {creatorBalance.toFixed(4)} XLM
              </span>
            </div>

            {isBalanceSufficient === false && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                Insufficient balance. Need {(totalRequired - creatorBalance).toFixed(4)} XLM more.
              </div>
            )}
          </div>
        )}
      </div>

      {disabled && (
        <div className="mt-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs">
          Submit button will be disabled until all costs can be covered.
        </div>
      )}
    </div>
  );
}
