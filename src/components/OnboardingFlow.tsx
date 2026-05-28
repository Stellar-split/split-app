"use client";

import { useState, useEffect } from "react";
import WalletConnect from "@/components/WalletConnect";

const ONBOARDING_KEY = "stellarsplit_onboarded";

export default function OnboardingFlow() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    const onboarded = localStorage.getItem(ONBOARDING_KEY);
    if (!onboarded) {
      setShow(true);
    }
  }, []);

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShow(false);
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSkip();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-800 max-w-md w-full p-6 sm:p-8">
        {/* Progress indicator */}
        <div className="flex gap-1 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-indigo-600" : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Connect Wallet */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Welcome to StellarSplit</h2>
            <p className="text-sm text-gray-400">
              Let's get you started. First, connect your Freighter wallet.
            </p>
            <WalletConnect />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: What is StellarSplit */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">What is StellarSplit?</h2>
            <div className="text-sm text-gray-400 space-y-3">
              <p>
                StellarSplit lets you create on-chain invoices where multiple payers each owe a share.
              </p>
              <p>
                When the invoice is fully funded, USDC automatically routes to all recipients.
              </p>
              <p>
                Perfect for splitting bills, group expenses, or shared projects.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Create First Invoice */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Create Your First Invoice</h2>
            <p className="text-sm text-gray-400">
              Ready to create your first invoice? Click the button below to get started.
            </p>
            <a
              href="/invoice/new"
              className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors text-center"
            >
              Create Invoice
            </a>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="flex flex-col gap-4 text-center">
            <h2 className="text-xl font-bold">You're All Set!</h2>
            <p className="text-sm text-gray-400">
              You can now create invoices and manage payments. Visit your dashboard anytime.
            </p>
            <button
              onClick={handleSkip}
              className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
