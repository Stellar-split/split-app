"use client";

import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import Link from "next/link";
import FundingProgress from "./FundingProgress";
import StatusBadge from "./StatusBadge";
import DeadlineCountdown from "./DeadlineCountdown";

interface Props {
  invoiceA: Invoice;
  invoiceB: Invoice;
  onPayA?: () => void;
  onPayB?: () => void;
}

/**
 * CompareInvoicesView — side-by-side comparison of two invoices.
 * Highlights differing fields in yellow.
 */
export default function CompareInvoicesView({ invoiceA, invoiceB, onPayA, onPayB }: Props) {
  const totalA = invoiceA.recipients.reduce((s, r) => s + r.amount, 0n);
  const totalB = invoiceB.recipients.reduce((s, r) => s + r.amount, 0n);

  const deadlineA = new Date(invoiceA.deadline * 1000).toLocaleDateString();
  const deadlineB = new Date(invoiceB.deadline * 1000).toLocaleDateString();

  const statusA = invoiceA.status as string;
  const statusB = invoiceB.status as string;

  const recipientsA = invoiceA.recipients.map((r) => truncateAddress(r.address)).join(", ");
  const recipientsB = invoiceB.recipients.map((r) => truncateAddress(r.address)).join(", ");

  const fundedA = formatAmount(invoiceA.funded);
  const fundedB = formatAmount(invoiceB.funded);

  const totalFormatA = formatAmount(totalA);
  const totalFormatB = formatAmount(totalB);

  const progressA = totalA > 0n ? (Number(invoiceA.funded) / Number(totalA)) * 100 : 0;
  const progressB = totalB > 0n ? (Number(invoiceB.funded) / Number(totalB)) * 100 : 0;

  const paymentCountA = invoiceA.payments?.length || 0;
  const paymentCountB = invoiceB.payments?.length || 0;

  // Highlight differing fields
  const isDifferent = (a: string | number, b: string | number) =>
    String(a) !== String(b);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-6 inline-block"
      >
        ← Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Compare Invoices
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Invoice #{invoiceA.id} vs Invoice #{invoiceB.id}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Invoice A */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Invoice #{invoiceA.id}
            </h2>
            <button
              onClick={onPayA}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Pay Invoice A
            </button>
          </div>

          <div className="space-y-4">
            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Status
              </p>
              <div
                className={
                  isDifferent(statusA, statusB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }
              >
                <StatusBadge status={invoiceA.status as any} size="sm" />
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Total Amount
              </p>
              <p
                className={`text-lg font-semibold ${
                  isDifferent(totalFormatA, totalFormatB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }`}
              >
                {totalFormatA} USDC
              </p>
            </div>

            {/* Funded */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Funded
              </p>
              <p
                className={
                  isDifferent(fundedA, fundedB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }
              >
                {fundedA} / {totalFormatA} USDC
              </p>
            </div>

            {/* Progress Bar */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Progress
              </p>
              <FundingProgress
                funded={invoiceA.funded}
                total={totalA}
                token={invoiceA.token || "USDC"}
              />
            </div>

            {/* Deadline */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Deadline
              </p>
              <p
                className={
                  isDifferent(deadlineA, deadlineB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }
              >
                {deadlineA}
              </p>
            </div>

            {/* Recipients */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Recipients
              </p>
              <div
                className={
                  isDifferent(recipientsA, recipientsB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 p-3 rounded-lg"
                    : ""
                }
              >
                <div className="flex flex-wrap gap-2">
                  {invoiceA.recipients.map((r, i) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400 px-2 py-1 rounded font-mono"
                    >
                      {truncateAddress(r.address)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment Count */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Payments Received
              </p>
              <p
                className={
                  isDifferent(paymentCountA, paymentCountB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }
              >
                {paymentCountA}
              </p>
            </div>
          </div>
        </div>

        {/* Invoice B */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Invoice #{invoiceB.id}
            </h2>
            <button
              onClick={onPayB}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Pay Invoice B
            </button>
          </div>

          <div className="space-y-4">
            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Status
              </p>
              <div
                className={
                  isDifferent(statusA, statusB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }
              >
                <StatusBadge status={invoiceB.status as any} size="sm" />
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Total Amount
              </p>
              <p
                className={`text-lg font-semibold ${
                  isDifferent(totalFormatA, totalFormatB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }`}
              >
                {totalFormatB} USDC
              </p>
            </div>

            {/* Funded */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Funded
              </p>
              <p
                className={
                  isDifferent(fundedA, fundedB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }
              >
                {fundedB} / {totalFormatB} USDC
              </p>
            </div>

            {/* Progress Bar */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Progress
              </p>
              <FundingProgress
                funded={invoiceB.funded}
                total={totalB}
                token={invoiceB.token || "USDC"}
              />
            </div>

            {/* Deadline */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Deadline
              </p>
              <p
                className={
                  isDifferent(deadlineA, deadlineB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }
              >
                {deadlineB}
              </p>
            </div>

            {/* Recipients */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                Recipients
              </p>
              <div
                className={
                  isDifferent(recipientsA, recipientsB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 p-3 rounded-lg"
                    : ""
                }
              >
                <div className="flex flex-wrap gap-2">
                  {invoiceB.recipients.map((r, i) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400 px-2 py-1 rounded font-mono"
                    >
                      {truncateAddress(r.address)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment Count */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                Payments Received
              </p>
              <p
                className={
                  isDifferent(paymentCountA, paymentCountB)
                    ? "bg-yellow-200 dark:bg-yellow-900/30 px-3 py-2 rounded-lg inline-block"
                    : ""
                }
              >
                {paymentCountB}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
