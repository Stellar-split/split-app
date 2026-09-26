"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { verifyAccessCode, hashAccessCode } from "@/lib/accessCode";

export { verifyAccessCode, hashAccessCode };

export interface AccessCodeGateProps {
  invoiceId: string;
  expectedHash?: string;
  isPrivate?: boolean;
  onUnlock?: () => void;
  children: React.ReactNode;
}

export default function AccessCodeGate({
  invoiceId,
  expectedHash,
  isPrivate = false,
  onUnlock,
  children,
}: AccessCodeGateProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKey = `invoice_unlocked_${invoiceId}`;

  // Check sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(storageKey);
      if (stored === "true") {
        setIsUnlocked(true);
      }
    }
  }, [storageKey]);

  // Focus input when private and locked
  useEffect(() => {
    if (isPrivate && !isUnlocked) {
      inputRef.current?.focus();
    }
  }, [isPrivate, isUnlocked]);

  // If not private or already unlocked, render children directly
  if (!isPrivate || isUnlocked) {
    return <>{children}</>;
  }

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = accessCode.trim();
    if (!trimmed) {
      setError("Please enter the access code");
      triggerShake();
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // If expectedHash is specified, verify against it; otherwise check if non-empty
      const isValid = expectedHash ? await verifyAccessCode(trimmed, expectedHash) : true;

      if (isValid) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(storageKey, "true");
        }
        setIsUnlocked(true);
        if (onUnlock) onUnlock();
      } else {
        setError("Incorrect access code");
        triggerShake();
      }
    } catch (err) {
      setError("Failed to verify access code");
      triggerShake();
    } finally {
      setIsVerifying(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    inputRef.current?.focus();
  };

  return (
    <div
      className="min-h-[70vh] flex items-center justify-center px-4 py-12"
      role="region"
      aria-label="Private invoice access code entry"
    >
      <style>{`
        @keyframes shakeKeyframe {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake-gate {
          animation: shakeKeyframe 0.4s ease-in-out;
        }
      `}</style>

      <div
        className={`w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl text-center transition-all ${
          isShaking ? "animate-shake-gate border-red-500/80 shadow-red-950/40" : ""
        }`}
      >
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-full bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center mx-auto mb-5 text-indigo-400">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-300 mb-3 border border-gray-700">
          Private Invoice #{invoiceId}
        </span>

        <h1 className="text-2xl font-bold text-white mb-2">Access Code Required</h1>
        <p className="text-sm text-gray-400 mb-6">
          This invoice is restricted. Please enter the access code to unlock invoice details and submit payments.
        </p>

        <form onSubmit={handleUnlock} className="space-y-4 text-left" noValidate>
          <div>
            <label htmlFor="access-code-input" className="block text-xs font-medium text-gray-300 mb-1.5">
              Access Code
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="access-code-input"
                type={showCode ? "text" : "password"}
                value={accessCode}
                onChange={(e) => {
                  setAccessCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter access code"
                aria-label="Access code"
                aria-required="true"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "access-code-error" : undefined}
                disabled={isVerifying}
                className={`w-full bg-gray-800/90 border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 pr-12 focus:outline-none focus:ring-2 transition-colors ${
                  error
                    ? "border-red-500 focus:ring-red-500/50"
                    : "border-gray-700 focus:ring-indigo-500/50 focus:border-indigo-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 p-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                aria-label={showCode ? "Hide access code" : "Show access code"}
              >
                {showCode ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <p id="access-code-error" role="alert" className="text-xs text-red-400 mt-2 font-medium">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full min-h-11 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Verifying...</span>
              </>
            ) : (
              "Unlock Invoice"
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-800">
          <Link
            href="/dashboard"
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors inline-flex items-center gap-1"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
