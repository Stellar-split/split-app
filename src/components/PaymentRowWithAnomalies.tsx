/**
 * Example integration: Payment row with anomaly detection
 *
 * This component demonstrates how to integrate the anomaly detector into a payment display.
 * Shows a single payment with its anomaly flags (if any) alongside standard payment info.
 *
 * Usage:
 * ```tsx
 * const payers = new Map([["GPAYER1", 5], ["GPAYER2", 0]]);  // payer address -> prior count
 * <PaymentRowWithAnomalies
 *   payment={payment}
 *   invoice={invoice}
 *   payerHistory={payers}
 * />
 * ```
 */

"use client";

import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice, Payment } from "@stellar-split/sdk";
import { detectAnomalies } from "@/lib/anomalyDetector";
import AnomalyIndicator from "@/components/AnomalyIndicator";

interface Props {
  payment: Payment;
  invoice: Invoice;
  /** Map of payer address → prior payment count across all invoices */
  payerHistory?: Map<string, number>;
  /** Optional row styling */
  className?: string;
}

export default function PaymentRowWithAnomalies({
  payment,
  invoice,
  payerHistory = new Map(),
  className = "",
}: Props) {
  const flags = detectAnomalies(payment, invoice, payerHistory);

  return (
    <tr className={`border-b border-gray-800 hover:bg-gray-900/50 ${className}`}>
      <td className="px-4 py-3 font-mono text-gray-400">
        {truncateAddress(payment.payer)}
      </td>
      <td className="px-4 py-3 text-gray-200">
        {formatAmount(payment.amount)} USDC
      </td>
      <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
        {/* Anomaly warning icon — only shown if flags detected */}
        <AnomalyIndicator flags={flags} />
        {/* Optional: timestamp if payment has one */}
        {(payment as any).timestamp && (
          <span className="text-xs text-gray-500">
            {new Date((payment as any).timestamp * 1000).toLocaleTimeString()}
          </span>
        )}
      </td>
    </tr>
  );
}
