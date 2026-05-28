"use client";

import { useState } from "react";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import PaymentProgress from "./PaymentProgress";
import PaymentBreakdownModal from "./PaymentBreakdownModal";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  total: bigint;
  publicKey: string;
  onPay: (amount: bigint, email?: string) => Promise<void>;
  onClose: () => void;
}

export default function PayModal({ invoice, total, onPay, onClose }: Props) {
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const parsed = (() => {
    try { return input ? parseAmount(input) : 0n; } catch { return 0n; }
  })();

  const previewFunded = invoice.funded + parsed;
  const currentPct = total > 0n ? Number((invoice.funded * 100n) / total) : 0;
  const previewPct = total > 0n ? Math.min(100, Number((previewFunded * 100n) / total)) : 0;

  // Mock fee breakdown (in production, call splitClient.calculateFee)
  const feeBreakdown = {
    gross: parsed,
    fee: parsed > 0n ? (parsed * 2n) / 100n : 0n, // 2% fee
    net: parsed > 0n ? parsed - (parsed * 2n) / 100n : 0n,
  };

  // Mock Stellar fee (in production, call splitClient.estimateFee)
  const stellarFee = 100000n; // stroops

  const handleReview = () => {
    if (!parsed || parsed <= 0n) return;
    setError(null);
    setShowBreakdown(true);
  };

  const handleConfirm = async () => {
    if (!parsed || parsed <= 0n) return;
    setPaying(true);
    try {
      await onPay(parsed, email || undefined);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 id="pay-modal-title" className="text-lg font-semibold">Pay Invoice #{invoice.id}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white text-xl leading-none">×</button>
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
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
        </div>

        {/* Preview progress */}
        {parsed > 0n && (
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
          <p className="text-xs text-gray-500 mt-1">We'll send a confirmation email after payment is confirmed on-chain.</p>
        </div>

        <button
          type="button"
          onClick={handleReview}
          disabled={paying || !parsed || parsed <= 0n}
          className="w-full px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors disabled:opacity-50"
        >
          {paying ? "Sending…" : "Review & Pay"}
        </button>
      </div>

      {showBreakdown && (
        <PaymentBreakdownModal
          amount={parsed}
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
