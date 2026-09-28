"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";

const ONBOARDING_KEY = "split-onboarded";
const ONBOARDING_STEP_KEY = "stellarsplit_onboarding_step";
const CHECKLIST_KEY = "stellarsplit_checklist";
const TOTAL_STEPS = 5;

// ── Checklist items ──────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: "wallet", label: "Connect your Freighter wallet" },
  { id: "invoice", label: "Create your first invoice" },
  { id: "share", label: "Share an invoice link" },
  { id: "payment", label: "Receive your first payment" },
  { id: "explore", label: "Explore the dashboard" },
] as const;

type ChecklistId = (typeof CHECKLIST_ITEMS)[number]["id"];

// ── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    id: "welcome",
    icon: "🌟",
    title: "Welcome to StellarSplit",
    description:
      "StellarSplit lets you create on-chain invoices, split payments between multiple recipients, and get paid in USDC on the Stellar network.",
    tooltip: "You can always revisit this guide from the Help menu.",
    hasVideo: false,
    videoPoster: "",
    videoSrc: "",
  },
  {
    id: "wallet",
    icon: "🔗",
    title: "Connect your Freighter wallet",
    description:
      "Freighter is a browser extension wallet for Stellar. Connect it below to sign transactions and create invoices on-chain.",
    tooltip: "Freighter is free and takes less than 2 minutes to set up.",
    hasVideo: false,
    videoPoster: "",
    videoSrc: "",
  },
  {
    id: "invoice",
    icon: "📄",
    title: "Create your first invoice",
    description:
      "Fill in recipients, amounts, and a deadline. Each recipient gets a unique Stellar address. The total is split automatically when payers send USDC.",
    tooltip: "Tip: you can add up to 20 recipients per invoice.",
    hasVideo: false,
    videoPoster: "",
    videoSrc: "",
  },
  {
    id: "share",
    icon: "🔗",
    title: "Share and get paid",
    description:
      "Every invoice gets a unique shareable link and QR code. Share it with payers — when fully funded, USDC routes automatically to all recipients.",
    tooltip: "Payers don't need a wallet to view the invoice status.",
    hasVideo: false,
    videoPoster: "",
    videoSrc: "",
  },
  {
    id: "checklist",
    icon: "✅",
    title: "Your getting-started checklist",
    description:
      "Track your progress as you explore StellarSplit. Complete each item to become a power user.",
    tooltip: "Your checklist progress is saved locally.",
    hasVideo: false,
    videoPoster: "",
    videoSrc: "",
  },
] as const;

// ── Tooltip bubble ────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-block ml-1.5">
      <button
        type="button"
        aria-label="Show tip"
        className="w-4 h-4 rounded-full bg-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.15] text-xs leading-none flex items-center justify-center transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        ?
      </button>
      {visible && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-56 bg-gray-800 text-slate-200 text-xs rounded-lg px-3 py-2 shadow-xl border border-white/[0.08] text-center"
        >
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-800" />
        </span>
      )}
    </span>
  );
}

// ── Checklist component ───────────────────────────────────────────────────────

function OnboardingChecklist({
  completed,
  onToggle,
}: {
  completed: Set<ChecklistId>;
  onToggle: (id: ChecklistId) => void;
}) {
  const doneCount = completed.size;
  const totalCount = CHECKLIST_ITEMS.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="flex flex-col gap-3">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{doneCount} of {totalCount} completed</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <ul className="flex flex-col gap-2" aria-label="Getting started checklist">
        {CHECKLIST_ITEMS.map((item) => {
          const done = completed.has(item.id);
          return (
            <li key={item.id}>
              <label className="flex items-center gap-3 cursor-pointer group">
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                    done
                      ? "bg-brand-500 border-brand-500"
                      : "border-white/[0.2] bg-white/[0.04] group-hover:border-brand-400"
                  }`}
                  aria-hidden="true"
                >
                  {done && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(item.id)}
                  className="sr-only"
                  aria-label={item.label}
                />
                <span className={`text-sm ${done ? "line-through text-slate-500" : "text-slate-200"}`}>
                  {item.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingFlow() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  const [checklistDone, setChecklistDone] = useState<Set<ChecklistId>>(new Set());

  // Load state from localStorage
  useEffect(() => {
    try {
      const onboarded = localStorage.getItem(ONBOARDING_KEY);
      if (onboarded === "true") return;
      const savedStep = localStorage.getItem(ONBOARDING_STEP_KEY);
      const savedChecklist = localStorage.getItem(CHECKLIST_KEY);

      setShow(true);
      if (savedStep) setStep(Math.min(parseInt(savedStep, 10), TOTAL_STEPS));
      if (savedChecklist) {
        const parsed = JSON.parse(savedChecklist) as ChecklistId[];
        setChecklistDone(new Set(parsed));
      }
    } catch {}
  }, []);

  const persistChecklist = useCallback((items: Set<ChecklistId>) => {
    try {
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify([...items]));
    } catch {}
  }, []);

  const handleToggleChecklist = useCallback(
    (id: ChecklistId) => {
      setChecklistDone((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persistChecklist(next);
        return next;
      });
    },
    [persistChecklist]
  );

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

  const handleBack = () => {
    if (step <= 1) return;
    const prev = step - 1;
    setStep(prev);
    try {
      localStorage.setItem(ONBOARDING_STEP_KEY, String(prev));
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
          <span className="text-xs text-slate-400 font-medium">
            Step {step} of {TOTAL_STEPS}
          </span>
          <button
            onClick={handleSkip}
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
            aria-label="Skip onboarding"
          >
            Skip for now
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 mt-3">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => {
                const s = i + 1;
                setStep(s);
                try { localStorage.setItem(ONBOARDING_STEP_KEY, String(s)); } catch {}
              }}
              className={`h-1 flex-1 rounded-full transition-all duration-300 focus:outline-none ${
                i < step ? "bg-brand-500" : "bg-white/[0.08] hover:bg-white/[0.15]"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-8 flex flex-col gap-4">
          <div className="flex flex-col items-center text-center gap-3">
            <span className="text-5xl" aria-hidden="true">{current.icon}</span>
            <h2 className="text-xl font-bold text-white flex items-center justify-center gap-1">
              {current.title}
              <Tooltip text={current.tooltip} />
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">{current.description}</p>
          </div>

          {/* Step-specific interactive content */}
          {step === 1 && (
            <div className="mt-2 bg-brand-900/30 rounded-xl p-4 border border-brand-700/30">
              <p className="text-xs text-brand-300 font-semibold mb-2 uppercase tracking-wider">What you can do</p>
              <ul className="text-xs text-slate-300 space-y-1.5">
                <li className="flex items-center gap-2"><span className="text-brand-400">✦</span> Create multi-recipient invoices on Stellar</li>
                <li className="flex items-center gap-2"><span className="text-brand-400">✦</span> Accept USDC payments with automatic splitting</li>
                <li className="flex items-center gap-2"><span className="text-brand-400">✦</span> Track payments in real time with on-chain proof</li>
                <li className="flex items-center gap-2"><span className="text-brand-400">✦</span> Export receipts and share QR codes</li>
              </ul>
            </div>
          )}

          {step === 2 && (
            <div className="mt-2">
              <WalletConnect />
              <p className="text-xs text-slate-500 text-center mt-3">
                Don&apos;t have Freighter?{" "}
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 hover:text-brand-300 underline"
                >
                  Install it free →
                </a>
              </p>
            </div>
          )}

          {step === 3 && (
            <Link
              href="/invoice/new?prefill=example"
              onClick={handleNext}
              className="mt-2 flex items-center justify-center h-10 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
            >
              Create example invoice →
            </Link>
          )}

          {step === 4 && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="bg-white/[0.04] rounded-lg p-3 text-xs text-slate-400 border border-white/[0.06]">
                <p className="font-semibold text-slate-300 mb-1">How sharing works:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copy your invoice link from the invoice detail page</li>
                  <li>Share it via email, chat, or the built-in QR code</li>
                  <li>Payers visit the link and pay with their Stellar wallet</li>
                  <li>Funds route to recipients automatically on-chain</li>
                </ol>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="mt-2">
              <OnboardingChecklist
                completed={checklistDone}
                onToggle={handleToggleChecklist}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex gap-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="h-10 px-4 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-sm font-medium transition-colors"
            >
              Back
            </button>
          )}
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
