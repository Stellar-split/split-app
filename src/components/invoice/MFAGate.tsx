"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export default function MFAGate({ isOpen, onClose, onSuccess }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCode("");
      setError(null);
      setSubmitting(false);
      setLockedUntil(null);
      setCountdown(0);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!lockedUntil) {
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setError(null);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const canSubmit = useMemo(() => /^\d{6}$/.test(code), [code]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    const walletAddress = localStorage.getItem("stellarsplit_wallet_address") || "default-user";
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch("/api/settings/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: walletAddress, code }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.lockedUntil) {
          setLockedUntil(data.lockedUntil);
        }
        setError(data.error || "Unable to verify the MFA code.");
        return;
      }

      onSuccess(data.mfaToken);
      onClose();
    } catch {
      setError("Unable to contact the MFA service.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="mfa-gate-title">
      <div className="w-full max-w-md rounded-2xl border border-indigo-500/30 bg-gray-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="mfa-gate-title" className="text-lg font-semibold text-white">Verify with authenticator</h2>
            <p className="mt-1 text-sm text-gray-400">Enter the 6-digit code from your authenticator app to continue.</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl text-gray-400 hover:text-white" aria-label="Close MFA gate">
            ×
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-gray-300" htmlFor="mfa-code-input">
            One-time code
          </label>
          <input
            id="mfa-code-input"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-center text-lg tracking-[0.35em] text-white outline-none focus:border-indigo-500"
            placeholder="123456"
            autoFocus
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
          {countdown > 0 && <p className="text-sm text-amber-400">MFA is locked for {countdown}s.</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit || countdown > 0}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Verifying…" : "Verify code"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-700 px-4 py-3 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
