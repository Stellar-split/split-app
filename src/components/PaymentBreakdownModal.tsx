"use client";

import { formatAmount } from "@stellar-split/sdk";

interface FeeBreakdown {
  gross: bigint;
  fee: bigint;
  net: bigint;
}

interface Props {
  amount: bigint;
  feeBreakdown: FeeBreakdown;
  stellarFee: bigint;
  onConfirm: () => void;
  onBack: () => void;
  confirming?: boolean;
  /** Currency the invoice was issued in (e.g. "USD", "EUR"). Defaults to USDC. */
  invoiceCurrency?: string;
  /** Converted XLM amount for the payment, if a conversion applies. */
  convertedXlm?: bigint;
  /** Exchange rate applied (invoice currency units per 1 XLM). */
  exchangeRate?: number;
  /** Whether the exchange rate is locked for the payment window. */
  rateLocked?: boolean;
  /** Unix timestamp (ms) when the locked rate expires. */
  rateLockExpiresAt?: number;
}

export default function PaymentBreakdownModal({
  amount,
  feeBreakdown,
  stellarFee,
  onConfirm,
  onBack,
  confirming = false,
  invoiceCurrency = "USDC",
  convertedXlm,
  exchangeRate,
  rateLocked = false,
  rateLockExpiresAt,
}: Props) {
  const hasConversion = convertedXlm !== undefined && exchangeRate !== undefined;
  const rateLockExpired =
    rateLockExpiresAt !== undefined && Date.now() >= rateLockExpiresAt;
  const rateLockActive = rateLocked && !rateLockExpired;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onBack}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakdown-modal-title"
        className="bg-gray-900 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="breakdown-modal-title" className="text-lg font-semibold">Payment Breakdown</h2>

        {/* Breakdown table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-700">
                <td className="px-4 py-3 text-gray-300">Gross Amount</td>
                <td className="px-4 py-3 text-right text-indigo-300 font-semibold">
                  {formatAmount(feeBreakdown.gross)} {invoiceCurrency}
                </td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="px-4 py-3 text-gray-300">Protocol Fee</td>
                <td className="px-4 py-3 text-right text-red-400 font-semibold">
                  -{formatAmount(feeBreakdown.fee)} {invoiceCurrency}
                </td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="px-4 py-3 text-gray-300">Net to Recipients</td>
                <td className="px-4 py-3 text-right text-green-400 font-semibold">
                  {formatAmount(feeBreakdown.net)} {invoiceCurrency}
                </td>
              </tr>
              <tr className={hasConversion ? "border-b border-gray-700" : undefined}>
                <td className="px-4 py-3 text-gray-300">Stellar Tx Fee</td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs">
                  ~{formatAmount(stellarFee)} {invoiceCurrency}
                </td>
              </tr>
              {hasConversion && (
                <tr>
                  <td className="px-4 py-3 text-gray-300">Converted to XLM</td>
                  <td className="px-4 py-3 text-right text-indigo-300 font-semibold">
                    {formatAmount(convertedXlm)} XLM
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Exchange rate & lock status */}
        {hasConversion && (
          <div className="bg-gray-800/50 rounded-lg p-3 text-xs flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Exchange Rate</span>
              <span className="text-gray-200 font-semibold">
                1 XLM = {exchangeRate} {invoiceCurrency}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Rate Lock</span>
              {rateLockActive ? (
                <span className="text-green-400 font-semibold">
                  Locked
                  {rateLockExpiresAt !== undefined && (
                    <> · expires {new Date(rateLockExpiresAt).toLocaleTimeString()}</>
                  )}
                </span>
              ) : rateLockExpired ? (
                <span className="text-red-400 font-semibold">Expired — refresh rate</span>
              ) : (
                <span className="text-yellow-400 font-semibold">Not locked</span>
              )}
            </div>
          </div>
        )}

        {/* Fee explanation */}
        <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
          <p>
            The protocol fee is deducted from your payment. Recipients receive the net amount. Stellar transaction fees are minimal and paid separately.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={confirming}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-600 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming || rateLockExpired}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {confirming ? "Waiting for signature…" : "Confirm & Pay"}
          </button>
        </div>
      </div>
    </div>
  );
}
