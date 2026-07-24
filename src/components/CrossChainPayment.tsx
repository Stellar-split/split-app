"use client";

import { useState, useEffect, useCallback } from "react";
import {
  SUPPORTED_CHAINS,
  estimateBridgeFee,
  connectWalletForChain,
  buildBridgePayment,
  pollBridgeStatus,
} from "@/lib/bridge";
import type {
  SupportedChain,
  FeeEstimate,
  BridgeStatusResult,
} from "@/lib/bridge";

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Chain selector tabs. */
function ChainSelector({
  selected,
  onSelect,
  disabled,
}: {
  selected: SupportedChain;
  onSelect: (chain: SupportedChain) => void;
  disabled: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Source chain" className="flex gap-2">
      {SUPPORTED_CHAINS.map((chain) => (
        <button
          key={chain.id}
          type="button"
          role="radio"
          aria-checked={selected === chain.id}
          disabled={disabled}
          onClick={() => onSelect(chain.id)}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            selected === chain.id
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {chain.label}
        </button>
      ))}
    </div>
  );
}

/** Fee breakdown table shown after chain selection + amount entry. */
function FeeBreakdown({
  amount,
  estimate,
}: {
  amount: string;
  estimate: FeeEstimate | null;
}) {
  if (!amount || parseFloat(amount) <= 0 || !estimate) return null;

  return (
    <dl className="bg-gray-800 rounded-lg p-4 text-sm flex flex-col gap-2">
      <div className="flex justify-between">
        <dt className="text-gray-400">You send</dt>
        <dd className="font-semibold text-white">{parseFloat(amount).toFixed(6)} USDC</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-gray-400">Bridge fee</dt>
        <dd className="text-yellow-300">{estimate.bridgeFee}</dd>
      </div>
      <div className="flex justify-between border-t border-gray-700 pt-2">
        <dt className="text-gray-300 font-medium">Net received on Stellar</dt>
        <dd className="font-bold text-green-400">{estimate.netAmount} USDC</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-gray-400">Estimated time</dt>
        <dd className="text-gray-300">{estimate.estimatedTime}</dd>
      </div>
    </dl>
  );
}

/** Wallet connect step. */
function WalletStep({
  chain,
  address,
  onConnect,
  connecting,
  error,
}: {
  chain: SupportedChain;
  address: string | null;
  onConnect: () => void;
  connecting: boolean;
  error: string | null;
}) {
  const meta = SUPPORTED_CHAINS.find((c) => c.id === chain)!;

  if (address) {
    return (
      <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-4 py-2.5">
        <span className="text-green-400 text-sm">✓</span>
        <span className="text-sm text-gray-300">
          {meta.walletName} connected:{" "}
          <span className="font-mono text-xs text-gray-400">
            {address.slice(0, 8)}…{address.slice(-6)}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className="w-full px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label={`Connect ${meta.walletName}`}
      >
        {connecting ? `Connecting ${meta.walletName}…` : `Connect ${meta.walletName}`}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

/** Progress stepper shown while polling bridge status. */
const STATUS_STEPS: Array<{ key: BridgeStatusResult["status"]; label: string }> = [
  { key: "pending",    label: "Source chain confirmed" },
  { key: "in_transit", label: "Bridge relay in transit" },
  { key: "relaying",   label: "Relaying to Stellar" },
  { key: "confirmed",  label: "Stellar relay confirmed" },
];

const STATUS_ORDER: BridgeStatusResult["status"][] = [
  "pending",
  "in_transit",
  "relaying",
  "confirmed",
];

function BridgeProgress({
  statusResult,
  sourceTxHash,
}: {
  statusResult: BridgeStatusResult;
  sourceTxHash: string;
}) {
  const currentIdx = STATUS_ORDER.indexOf(statusResult.status);

  return (
    <div className="flex flex-col gap-4">
      {/* Source tx hash */}
      <div className="bg-gray-800 rounded-lg px-4 py-3 text-xs">
        <p className="text-gray-400 mb-1">Source transaction</p>
        <p className="font-mono text-gray-200 break-all">{sourceTxHash}</p>
      </div>

      {/* Steps */}
      <ol className="flex flex-col gap-2" aria-label="Bridge progress">
        {STATUS_STEPS.map((step, idx) => {
          const done = idx <= currentIdx;
          const active = idx === currentIdx && statusResult.status !== "confirmed";
          return (
            <li
              key={step.key}
              className={`flex items-center gap-3 text-sm ${
                done ? "text-white" : "text-gray-500"
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  done
                    ? statusResult.status === "confirmed" || idx < currentIdx
                      ? "bg-green-500 text-white"
                      : "bg-indigo-500 text-white"
                    : "bg-gray-700 text-gray-500"
                } ${active ? "animate-pulse" : ""}`}
              >
                {idx < currentIdx || statusResult.status === "confirmed"
                  ? "✓"
                  : idx + 1}
              </span>
              <span>{step.label}</span>
              {active && (
                <span className="ml-auto text-xs text-indigo-400 animate-pulse">
                  In progress…
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Stellar tx hash on confirmed */}
      {statusResult.stellarTxHash && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-3 text-xs">
          <p className="text-green-400 font-semibold mb-1">✓ Confirmed on Stellar</p>
          <p className="font-mono text-green-300 break-all">
            {statusResult.stellarTxHash}
          </p>
        </div>
      )}

      {/* Failed state */}
      {statusResult.status === "failed" && (
        <p className="text-red-400 text-sm">{statusResult.message}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  /** Invoice ID used as the reference in the bridge payment. */
  invoiceId: string;
  /** Stellar contract / escrow address that receives the bridged funds. */
  stellarDestination: string;
}

type Step = "select" | "wallet" | "submit" | "polling" | "done";

/**
 * CrossChainPayment — full cross-chain payment flow from Ethereum or Solana.
 *
 * Flow:
 *  1. Select source chain
 *  2. Enter USDC amount → see live fee estimate
 *  3. Connect MetaMask / Phantom
 *  4. Submit bridge payment
 *  5. Poll status until Stellar relay confirmed
 */
export default function CrossChainPayment({ invoiceId, stellarDestination }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");

  // Chain & amount
  const [chain, setChain] = useState<SupportedChain>("ethereum");
  const [amount, setAmount] = useState("");
  const [estimate, setEstimate] = useState<FeeEstimate | null>(null);

  // Wallet
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sourceTxHash, setSourceTxHash] = useState<string>("");
  const [bridgeId, setBridgeId] = useState<string>("");

  // Polling
  const [statusResult, setStatusResult] = useState<BridgeStatusResult | null>(null);

  // Recalculate fee estimate whenever chain or amount changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      setEstimate(estimateBridgeFee(chain, amount));
    } else {
      setEstimate(null);
    }
  }, [chain, amount]);

  // Reset wallet when chain changes
  useEffect(() => {
    setWalletAddress(null);
    setWalletError(null);
  }, [chain]);

  const handleChainSelect = (c: SupportedChain) => {
    setChain(c);
    setStep("select");
  };

  const handleConnectWallet = async () => {
    setWalletConnecting(true);
    setWalletError(null);
    try {
      const addr = await connectWalletForChain(chain);
      setWalletAddress(addr);
      setStep("submit");
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : String(e));
    } finally {
      setWalletConnecting(false);
    }
  };

  const handleProceedToWallet = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setStep("wallet");
  };

  const handleSubmit = useCallback(async () => {
    if (!walletAddress) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await buildBridgePayment({
        chain,
        fromAddress: walletAddress,
        invoiceId,
        amount,
        stellarDestination,
      });
      setSourceTxHash(result.sourceTxHash);
      setBridgeId(result.bridgeId);
      setStep("polling");

      await pollBridgeStatus(result.bridgeId, (s) => {
        setStatusResult(s);
        if (s.status === "confirmed") setStep("done");
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [walletAddress, chain, invoiceId, amount, stellarDestination]);

  const handleReset = () => {
    setStep("select");
    setAmount("");
    setEstimate(null);
    setWalletAddress(null);
    setWalletError(null);
    setSubmitError(null);
    setSourceTxHash("");
    setBridgeId("");
    setStatusResult(null);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Pay from another chain"
      >
        🌉 Pay from Another Chain
      </button>
    );
  }

  return (
    <section
      aria-label="Cross-chain payment"
      className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex flex-col gap-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">Pay from Another Chain</h3>
        {step !== "polling" && (
          <button
            type="button"
            onClick={handleReset}
            aria-label="Close cross-chain payment"
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Step 1 & 2: Chain + Amount ─────────────────────────────────────── */}
      {(step === "select" || step === "wallet" || step === "submit") && (
        <>
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
              Source chain
            </p>
            <ChainSelector
              selected={chain}
              onSelect={handleChainSelect}
              disabled={false}
            />
          </div>

          <div>
            <label
              htmlFor="bridge-amount"
              className="block text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide"
            >
              Amount (USDC)
            </label>
            <input
              id="bridge-amount"
              type="number"
              step="0.000001"
              min="0.000001"
              placeholder="0.000000"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (step !== "select") setStep("select");
              }}
              disabled={false}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              aria-label="Amount in USDC to send from source chain"
            />
          </div>

          {/* Fee estimate */}
          <FeeBreakdown amount={amount} estimate={estimate} />
        </>
      )}

      {/* ── Step 2 → 3 proceed button ─────────────────────────────────────── */}
      {step === "select" && amount && parseFloat(amount) > 0 && (
        <button
          type="button"
          onClick={handleProceedToWallet}
          className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Continue →
        </button>
      )}

      {/* ── Step 3: Wallet connect ────────────────────────────────────────── */}
      {(step === "wallet" || step === "submit") && (
        <div>
          <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
            Connect wallet
          </p>
          <WalletStep
            chain={chain}
            address={walletAddress}
            onConnect={handleConnectWallet}
            connecting={walletConnecting}
            error={walletError}
          />
        </div>
      )}

      {/* ── Step 4: Submit ────────────────────────────────────────────────── */}
      {step === "submit" && walletAddress && (
        <div className="flex flex-col gap-2">
          {submitError && (
            <p className="text-red-400 text-sm">{submitError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-sm transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Submit bridge payment"
          >
            {submitting ? "Submitting…" : `Bridge ${parseFloat(amount).toFixed(6)} USDC`}
          </button>
        </div>
      )}

      {/* ── Step 5: Polling progress ──────────────────────────────────────── */}
      {(step === "polling" || step === "done") && statusResult && (
        <BridgeProgress
          statusResult={statusResult}
          sourceTxHash={sourceTxHash}
        />
      )}

      {/* ── Done: actions ────────────────────────────────────────────────── */}
      {step === "done" && (
        <button
          type="button"
          onClick={handleReset}
          className="w-full px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Close
        </button>
      )}

      {/* Polling spinner / status message when not yet done */}
      {step === "polling" && statusResult && statusResult.status !== "confirmed" && (
        <p className="text-xs text-indigo-400 animate-pulse text-center">
          {statusResult.message}
        </p>
      )}

      {/* bridgeId used only internally — suppress TS unused warning */}
      {bridgeId && false && <span>{bridgeId}</span>}
    </section>
  );
}
