"use client";

import { useState, useEffect } from "react";
import FocusTrap from "./FocusTrap";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import PaymentProgress from "./PaymentProgress";
import PaymentBreakdownModal from "./PaymentBreakdownModal";
import type { Invoice } from "@stellar-split/sdk";
import { checkBudget, getBudgetLimit, setBudgetLimit, clearBudgetLimit } from "@/lib/budgetTracker";
import { fetchUsdcBalance, USDC_CONTRACT_ID } from "@/lib/stellar";

const STELLAR_EXPERT_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

type PaymentResult = { txHash?: string } | void;

interface PaymentOptions {
  tip: bigint;
  donateOnFailure: boolean;
}

interface Props {
  invoice: Invoice;
  total: bigint;
  publicKey: string;
  onPay: (amount: bigint, email?: string, options?: PaymentOptions) => Promise<PaymentResult>;
  onClose: () => void;
}

function positive(value: bigint) {
  return value > 0n ? value : 0n;
}

function getDefaultPaymentAmount(invoice: Invoice, total: bigint, publicKey: string) {
  const remainingInvoiceAmount = positive(total - invoice.funded);
  const recipientShare = invoice.recipients.find((recipient) => recipient.address === publicKey)?.amount;
  const paidByUser = invoice.payments
    .filter((payment) => payment.payer === publicKey)
    .reduce((sum, payment) => sum + payment.amount, 0n);
  const targetShare = recipientShare ?? remainingInvoiceAmount;
  const remainingShare = positive(targetShare - paidByUser);
  return remainingShare > remainingInvoiceAmount ? remainingInvoiceAmount : remainingShare;
}

export function getPaymentErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.toLowerCase();

  if (normalized.includes("insufficient") || normalized.includes("underfunded") || normalized.includes("balance")) {
    return "Your USDC balance is too low for this payment. Lower the amount or add funds to your wallet.";
  }
  if (normalized.includes("closed") || normalized.includes("released") || normalized.includes("refunded") || normalized.includes("not pending")) {
    return "This invoice is no longer accepting payments. Refresh the invoice to see its latest status.";
  }
  if (normalized.includes("reject") || normalized.includes("declin") || normalized.includes("cancel")) {
    return "The Freighter signing request was cancelled. Click Confirm & Pay again when you are ready to sign.";
  }
  if (normalized.includes("freighter") || normalized.includes("wallet")) {
    return "Freighter is not connected or is locked. Connect your wallet, then try the payment again.";
  }
  if (normalized.includes("timeout") || normalized.includes("network")) {
    return "The Stellar network request timed out. Check your connection and try again.";
  }

  return raw || "Payment failed. Please try again.";
}

export default function PayModal({ invoice, total, publicKey, onPay, onClose }: Props) {
  const [input, setInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [donateOnFailure, setDonateOnFailure] = useState(false);
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [budgetDismissed, setBudgetDismissed] = useState(false);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const defaultAmount = getDefaultPaymentAmount(invoice, total, publicKey);

  const parsed = (() => {
    try { return input ? parseAmount(input) : 0n; } catch { return 0n; }
  })();

  const parsedTip = (() => {
    try { return tipInput ? parseAmount(tipInput) : 0n; } catch { return 0n; }
  })();

  const paymentTotal = parsed + parsedTip;
  const remainingInvoiceAmount = positive(total - invoice.funded);

  const budgetCheck = publicKey && parsed > 0n
    ? checkBudget(publicKey, paymentTotal)
    : null;
  const showBudgetWarning = !budgetDismissed && !!budgetCheck?.wouldExceed;

  useEffect(() => {
    setInput(formatAmount(defaultAmount));
  }, [defaultAmount]);

  useEffect(() => {
    if (publicKey) {
      const existing = getBudgetLimit(publicKey);
      if (existing !== null) setBudgetInput(String(existing));
    }
  }, [publicKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadBalance() {
      if (!publicKey || !USDC_CONTRACT_ID) {
        setBalance(null);
        setBalanceError(USDC_CONTRACT_ID ? null : "USDC contract not configured");
        return;
      }

      setBalanceLoading(true);
      setBalanceError(null);
      try {
        const nextBalance = await fetchUsdcBalance(publicKey);
        if (!cancelled) setBalance(nextBalance);
      } catch {
        if (!cancelled) {
          setBalance(null);
          setBalanceError("Unable to load USDC balance");
        }
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    }

    loadBalance();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const previewFunded = invoice.funded + paymentTotal;
  const currentPct = total > 0n ? Number((invoice.funded * 100n) / total) : 0;
  const previewPct = total > 0n ? Math.min(100, Number((previewFunded * 100n) / total)) : 0;

  // Mock fee breakdown (in production, call splitClient.calculateFee)
  const feeBreakdown = {
    gross: paymentTotal,
    fee: paymentTotal > 0n ? (paymentTotal * 2n) / 100n : 0n, // 2% fee
    net: paymentTotal > 0n ? paymentTotal - (paymentTotal * 2n) / 100n : 0n,
  };

  // Mock Stellar fee (in production, call splitClient.estimateFee)
  const stellarFee = 100000n; // stroops

  const handleReview = () => {
    if (!parsed || parsed <= 0n) return;
    if (parsed > remainingInvoiceAmount) {
      setError(`Amount is greater than the remaining invoice balance of ${formatAmount(remainingInvoiceAmount)} USDC.`);
      return;
    }
    if (parsedTip < 0n) {
      setError("Tip cannot be negative.");
      return;
    }
    if (balance !== null && paymentTotal > balance) {
      setError(getPaymentErrorMessage("insufficient balance"));
      return;
    }
    setError(null);
    setShowBreakdown(true);
  };

  const handleConfirm = async () => {
    if (!parsed || parsed <= 0n) {
      setError("Enter a USDC amount greater than zero.");
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const result = await onPay(paymentTotal, email || undefined, {
        tip: parsedTip,
        donateOnFailure,
      });
      const txHash = result && "txHash" in result ? result.txHash : undefined;
      setSuccessTxHash(txHash || "pending");
      setShowBreakdown(false);
      window.dispatchEvent(new CustomEvent("usdc-balance-refresh"));
    } catch (err) {
      setShowBreakdown(false);
      setError(getPaymentErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const balanceLabel = balanceLoading
    ? "Loading USDC balance..."
    : balance !== null
      ? `${formatAmount(balance)} USDC available`
      : balanceError || "USDC balance unavailable";

  if (successTxHash) {
    const hasExplorerHash = successTxHash !== "pending";
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <FocusTrap onClose={onClose}>
          <div className="bg-gray-900 border border-green-500/30 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 id="pay-modal-title" className="text-lg font-semibold text-green-400">
                Payment confirmed
              </h2>
              <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">×</button>
            </div>

            <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4">
              <p className="text-sm text-green-200">
                Your payment was submitted to Stellar. The invoice will update after the transaction settles.
              </p>
              {hasExplorerHash && (
                <p className="mt-3 text-xs font-mono text-gray-300 break-all">
                  {successTxHash}
                </p>
              )}
            </div>

            {hasExplorerHash && (
              <a
                href={`${STELLAR_EXPERT_BASE}/${successTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                View on Stellar Expert
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </FocusTrap>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <FocusTrap onClose={onClose}>
        <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 id="pay-modal-title" className="text-lg font-semibold">Pay Invoice #{invoice.id}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">×</button>
        </div>

        {/* Current progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Current</span>
            <span>{currentPct.toFixed(1)}%</span>
          </div>
          <PaymentProgress funded={invoice.funded} total={total} />
        </div>

        {/* Amount input */}
        <div>
          <label htmlFor="modal-pay-amount" className="block text-sm font-medium text-gray-300 mb-1">
            Amount (USDC)
          </label>
          <input
            id="modal-pay-amount"
            type="number"
            step="0.0000001"
            min="0.0000001"
            placeholder="0.00"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            autoFocus
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs">
            <span className={balance !== null ? "text-indigo-300" : "text-gray-500"}>
              {balanceLabel}
            </span>
            <button
              type="button"
              onClick={() => setInput(formatAmount(defaultAmount))}
              className="text-indigo-300 hover:text-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              Use remaining share
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="modal-pay-tip" className="block text-sm font-medium text-gray-300 mb-1">
              Tip (optional)
            </label>
            <input
              id="modal-pay-tip"
              type="number"
              step="0.0000001"
              min="0"
              placeholder="0.00"
              value={tipInput}
              onChange={(e) => setTipInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={donateOnFailure}
              onChange={(e) => setDonateOnFailure(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
            />
            Donate on failure
          </label>
        </div>

        {parsedTip > 0n && (
          <p className="text-xs text-gray-500">
            Tip is added to this payment. Total authorization: {formatAmount(paymentTotal)} USDC.
          </p>
        )}

        {/* Preview progress */}
        {paymentTotal > 0n && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>After payment</span>
              <span className="text-indigo-300">{previewPct.toFixed(1)}%</span>
            </div>
            <PaymentProgress funded={previewFunded} total={total} />
            <p className="text-xs text-gray-500 mt-1">
              {formatAmount(previewFunded)} / {formatAmount(total)} USDC
            </p>
          </div>
        )}

        {showBudgetWarning && budgetCheck && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 bg-amber-950/60 border border-amber-700 rounded-lg px-4 py-3 text-sm text-amber-300"
          >
            <p>
              This payment would exceed your{" "}
              <span className="font-semibold">
                {budgetCheck.limitUnits / 10_000_000n} USDC
              </span>{" "}
              monthly budget. You have spent{" "}
              <span className="font-semibold">
                {formatAmount(budgetCheck.spent)} USDC
              </span>{" "}
              in the last 30 days.
            </p>
            <button
              type="button"
              onClick={() => setBudgetDismissed(true)}
              aria-label="Dismiss budget warning"
              className="shrink-0 text-amber-400 hover:text-amber-200 text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              ×
            </button>
          </div>
        )}

        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

        {/* Email input (optional) */}
        <div>
          <label htmlFor="modal-pay-email" className="block text-sm font-medium text-gray-300 mb-1">
            Email (optional)
          </label>
          <input
            id="modal-pay-email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">We&apos;ll send a confirmation email after payment is confirmed on-chain.</p>
        </div>

        <button
          type="button"
          onClick={handleReview}
          disabled={paying || !parsed || parsed <= 0n}
          className="w-full px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {paying ? "Waiting for signature..." : "Review & Pay"}
        </button>

        {publicKey && (
          <div className="border-t border-gray-800 pt-3">
            <button
              type="button"
              onClick={() => setShowBudgetSettings((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {showBudgetSettings ? "Hide" : "Configure"} monthly budget limit
            </button>
            {showBudgetSettings && (
              <div className="mt-3 flex flex-col gap-2">
                <label htmlFor="budget-limit" className="text-xs font-medium text-gray-400">
                  Monthly limit (USDC)
                </label>
                <div className="flex gap-2">
                  <input
                    id="budget-limit"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1000"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = parseFloat(budgetInput);
                      if (!isNaN(n) && n > 0) setBudgetLimit(publicKey, n);
                      setShowBudgetSettings(false);
                      setBudgetDismissed(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    Save
                  </button>
                  {getBudgetLimit(publicKey) !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        clearBudgetLimit(publicKey);
                        setBudgetInput("");
                        setShowBudgetSettings(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </FocusTrap>

      {showBreakdown && (
        <PaymentBreakdownModal
          amount={paymentTotal}
          feeBreakdown={feeBreakdown}
          stellarFee={stellarFee}
          onConfirm={handleConfirm}
          onBack={() => setShowBreakdown(false)}
          confirming={paying}
        />
      )}
    </div>
  );
}
