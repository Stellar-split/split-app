"use client";

import { useState, useEffect, useCallback } from "react";
import { formatAmount, parseAmount } from "@stellar-split/sdk";
import {
  generateBlindingFactor,
  createPedersenCommitment,
  saveBlindingFactor,
  loadBlindingFactor,
  hasBlindingFactor,
  saveCommittedAmount,
  loadCommittedAmount,
  markRevealed,
  isRevealed,
  submitCommitment,
  revealPayment,
} from "@/lib/confidential";

type Step =
  | "commit"
  | "committing"
  | "committed"
  | "reveal"
  | "revealing"
  | "revealed"
  | "missing_blinding";

interface Props {
  invoiceId: string;
  publicKey: string;
}

function confidentialPaymentMessage(invoiceId: string) {
  return (
    <div className="text-xs text-gray-400 space-y-2 mt-3 bg-gray-900/40 rounded-lg px-3 py-2">
      <p>
        Confidential payments keep your transaction amount private on the
        Stellar network. Instead of recording the amount directly, a
        cryptographic commitment is stored on-chain. In a second step, you
        reveal the actual payment amount.
      </p>
      <p>
        Two steps are needed: first you submit a commitment (a sealed envelope
        containing the amount), then later you reveal what is inside. This
        confirms the amount matches the commitment without exposing it early.
      </p>
      <p>
        A recovery secret (blinding factor) is stored in your browser so that
        only you can open the commitment. If you clear your browser data or
        switch devices, this secret is lost and you will not be able to reveal
        the payment.
      </p>
    </div>
  );
}

export default function ConfidentialPaymentFlow({
  invoiceId,
  publicKey,
}: Props) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("commit");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    const alreadyRevealed = isRevealed(invoiceId, publicKey);
    if (alreadyRevealed) {
      setStep("revealed");
      return;
    }
    const hasBlinding = hasBlindingFactor(invoiceId, publicKey);
    if (hasBlinding) {
      const storedAmount = loadCommittedAmount(invoiceId, publicKey);
      if (storedAmount) {
        setAmount(storedAmount);
      }
      setStep("reveal");
    } else {
      setStep("commit");
    }
  }, [invoiceId, publicKey]);

  const handleCommit = useCallback(async () => {
    if (!publicKey) return;
    const parsed = parseAmount(amount);
    if (parsed <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setError(null);
    setStep("committing");
    try {
      const blindingFactor = generateBlindingFactor();
      const commitment = await createPedersenCommitment(parsed, blindingFactor);
      await submitCommitment({
        payer: publicKey,
        invoiceId,
        commitment,
      });
      saveBlindingFactor(invoiceId, publicKey, blindingFactor);
      saveCommittedAmount(invoiceId, publicKey, amount);
      setStep("committed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("commit");
    }
  }, [amount, invoiceId, publicKey]);

  const handleReveal = useCallback(async () => {
    if (!publicKey) return;
    const blindingFactor = loadBlindingFactor(invoiceId, publicKey);
    if (!blindingFactor) {
      setStep("missing_blinding");
      return;
    }
    setError(null);
    setStep("revealing");
    try {
      const parsed = parseAmount(amount);
      const result = await revealPayment({
        payer: publicKey,
        invoiceId,
        amount: parsed,
        blindingFactor,
      });
      setTxHash(result.txHash);
      markRevealed(invoiceId, publicKey);
      setStep("revealed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("reveal");
    }
  }, [amount, invoiceId, publicKey]);

  if (step === "revealed") {
    return (
      <section className="mb-8 bg-gray-800/60 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Confidential Payment
        </h2>
        <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4">
          <p className="text-sm text-green-200 font-medium">
            Payment revealed successfully
          </p>
          {txHash && (
            <p className="mt-2 text-xs font-mono text-gray-400 break-all">
              {txHash}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 bg-gray-800/60 border border-gray-700 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-4">
        Confidential Payment
      </h2>

      {step === "missing_blinding" && (
        <div
          role="alert"
          className="rounded-xl bg-amber-950/60 border border-amber-700 p-4 mb-4"
        >
          <p className="text-sm text-amber-300 font-medium mb-1">
            Recovery secret not found
          </p>
          <p className="text-xs text-amber-400/80">
            The recovery secret needed to reveal this payment was stored in your
            browser. It may have been lost because you cleared your browser data
            or are using a different browser or device. Without this secret, the
            payment cannot be revealed.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="confidential-amount"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Amount (USDC)
        </label>
        <input
          id="confidential-amount"
          type="number"
          step="0.0000001"
          min="0.0000001"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={step === "committing" || step === "revealing" || step === "reveal"}
          className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-sm mt-3">
          {error}
        </p>
      )}

      {step === "reveal" && (
        <button
          type="button"
          onClick={handleReveal}
          className="mt-4 w-full min-h-12 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-colors"
        >
          Reveal Payment
        </button>
      )}

      {(step === "commit" || step === "committing") && (
        <button
          type="button"
          onClick={handleCommit}
          disabled={step === "committing" || !amount}
          className="mt-4 w-full min-h-12 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-colors disabled:opacity-50"
        >
          {step === "committing" ? "Submitting Commitment…" : "Commit Payment"}
        </button>
      )}

      {step === "committed" && (
        <div className="mt-4 rounded-xl bg-green-500/10 border border-green-500/30 p-4">
          <p className="text-sm text-green-200 font-medium">
            Commitment submitted successfully
          </p>
          <p className="text-xs text-green-300/80 mt-1">
            The blinding factor has been saved in your browser. You can now
            reveal the payment.
          </p>
          <button
            type="button"
            onClick={() => setStep("reveal")}
            className="mt-3 w-full min-h-11 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-sm transition-colors"
          >
            Continue to Reveal
          </button>
        </div>
      )}

      {step === "revealing" && (
        <div className="mt-4 flex items-center gap-3 text-gray-300 text-sm">
          <svg
            className="animate-spin h-4 w-4 text-indigo-400"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Revealing payment…</span>
        </div>
      )}

      {confidentialPaymentMessage(invoiceId)}
    </section>
  );
}
