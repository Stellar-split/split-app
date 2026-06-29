"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";

const ONBOARDING_KEY = "split-onboarded";
const ONBOARDING_STEP_KEY = "stellarsplit_onboarding_step";
const TOTAL_STEPS = 3;

const STEPS = [
  {
    icon: "🔗",
    title: "Connect your Freighter wallet",
    description:
      "Freighter is a browser extension wallet for Stellar. Connect it to create and pay invoices on-chain.",
  },
  {
    icon: "📄",
    title: "Create your first invoice",
    description:
      "Fill in recipients, amounts, and a deadline. We'll pre-fill an example to get you started fast.",
  },
  {
    icon: "🔗",
    title: "Share and get paid",
    description:
      "Every invoice gets a unique link. Share it with payers — when the invoice is fully funded, USDC routes automatically to all recipients.",
  },
];

export default function OnboardingFlow() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    try {
      const onboarded = localStorage.getItem(ONBOARDING_KEY);
      if (onboarded === "true") return;
      const savedStep = localStorage.getItem(ONBOARDING_STEP_KEY);
      setShow(true);
      if (savedStep) setStep(Math.min(parseInt(savedStep, 10), TOTAL_STEPS));
    } catch {}
  }, []);

  const handleSkip = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
      localStorage.removeItem(ONBOARDING_STEP_KEY);
    } catch {}
    setShow(false);
  };

  const handleNext = () => {
    if (step >= TOTAL_STEPS) {
      handleSkip();
      return;
    }
    const next = step + 1;
    setStep(next);
    try {
      localStorage.setItem(ONBOARDING_STEP_KEY, String(next));
    } catch {}
  };

  if (!show) return null;

  const current = STEPS[step - 1];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to StellarSplit"
    >
      <div className="w-full max-w-md bg-surface-800 rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Header bar */}
        <div className="px-6 pt-6 pb-0 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Step {step} of {TOTAL_STEPS}
          </span>
          <button
            onClick={handleSkip}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Skip onboarding"
          >
            Skip for now
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 mt-3">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < step ? "bg-brand-500" : "bg-white/[0.08]"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-8 flex flex-col gap-4">
          <div className="flex flex-col items-center text-center gap-3">
            <span className="text-5xl" aria-hidden="true">{current.icon}</span>
            <h2 className="text-xl font-bold text-white">{current.title}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{current.description}</p>
          </div>

          {/* Step 1: wallet connect inline */}
          {step === 1 && (
            <div className="mt-2">
              <WalletConnect />
            </div>
          )}

          {/* Step 2: CTA to create invoice with example values */}
          {step === 2 && (
            <Link
              href="/invoice/new?prefill=example"
              onClick={handleNext}
              className="mt-2 flex items-center justify-center h-10 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
            >
              Create example invoice →
            </Link>
          )}

          {/* Step 3: share explanation, no extra widget needed */}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-sm font-medium transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="flex-1 h-10 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
          >
            {step === TOTAL_STEPS ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
