"use client";

import { useEffect, useState } from "react";
import { getFreighterPublicKey } from "@/lib/freighter";
import { splitClient } from "@/lib/stellar";

const STORAGE_KEY = "recipientOnboarded";
const TOTAL_STEPS = 3;

export default function RecipientOnboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  const [invoiceCount, setInvoiceCount] = useState(0);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    async function check() {
      try {
        const address = await getFreighterPublicKey();
        if (!address) return;

        const invoices = await (splitClient as any).getInvoicesByRecipient(address);
        if (!invoices || invoices.length === 0) return;

        setInvoiceCount(invoices.length);
        setShow(true);
      } catch {
        // wallet not connected or SDK method unavailable — skip silently
      }
    }

    check();

    // Re-check when wallet connects later in the session
    const onWalletEvent = () => check();
    window.addEventListener("wallet-connected", onWalletEvent);
    return () => window.removeEventListener("wallet-connected", onWalletEvent);
  }, []);

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  const next = () => (step < TOTAL_STEPS ? setStep((s: number) => s + 1) : complete());

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recipient onboarding"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 flex flex-col gap-5">
        {/* Progress bar */}
        <div className="flex gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < step ? "bg-indigo-500" : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Step 1 — You have incoming payments */}
        {step === 1 && (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">You have incoming payments 🎉</h2>
              <p className="text-sm text-gray-400">
                Your wallet is listed as a recipient on{" "}
                <span className="text-white font-semibold">
                  {invoiceCount} invoice{invoiceCount !== 1 ? "s" : ""}
                </span>
                . StellarSplit is an on-chain invoicing tool on Stellar — when an invoice is fully
                funded, USDC is automatically routed to you.
              </p>
            </div>
            <StepActions step={step} total={TOTAL_STEPS} onNext={next} onSkip={complete} />
          </>
        )}

        {/* Step 2 — How release works */}
        {step === 2 && (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">How payment release works</h2>
              <ul className="text-sm text-gray-400 space-y-2 list-none">
                <li className="flex gap-2">
                  <span className="text-indigo-400 shrink-0">1.</span>
                  Payers fund their share of the invoice in USDC.
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 shrink-0">2.</span>
                  Once the invoice is 100% funded, the smart contract releases funds automatically.
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 shrink-0">3.</span>
                  Your share lands directly in your Stellar wallet — no action needed from you.
                </li>
              </ul>
            </div>
            <StepActions step={step} total={TOTAL_STEPS} onNext={next} onSkip={complete} />
          </>
        )}

        {/* Step 3 — Go to recipient portal */}
        {step === 3 && (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">Track your payments</h2>
              <p className="text-sm text-gray-400">
                Head to your recipient portal to see all invoices you&apos;re part of, track funding
                progress, and view your payment history.
              </p>
            </div>
            <a
              href="/recipient"
              onClick={complete}
              className="w-full text-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Go to Recipient Portal →
            </a>
            <button
              onClick={complete}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
            >
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StepActions({
  step,
  total,
  onNext,
  onSkip,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex gap-2 mt-1">
      <button
        onClick={onSkip}
        className="flex-1 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
      >
        Skip
      </button>
      <button
        onClick={onNext}
        className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        {step === total - 1 ? "Next" : "Next"}
      </button>
    </div>
  );
}
