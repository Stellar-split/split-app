"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import FocusTrap from "@/components/FocusTrap";
import { useWalletContext } from "@/contexts/WalletContext";
import {
  SECURITY_EVENT_NAME,
  SECURITY_TIPS,
  detectSecretMaterial,
  detectWalletAnomalies,
  isConnectionEncrypted,
  readSecurityEvents,
  recordSecurityEvent,
  type SecretKind,
  type WalletSecurityAlert,
} from "@/lib/walletSecurity";

export const TIPS_DISMISSED_KEY = "stellarsplit_security_tips_dismissed";
const TIPS_SHOWN_SESSION_KEY = "stellarsplit_security_tips_shown";

function storageGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function storageSet(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // ignore
  }
}

/**
 * WalletSecurityCenter — app-wide wallet safety layer:
 * - shows security tips once per session after a wallet connects,
 * - warns when a secret key or recovery phrase is typed or pasted anywhere,
 * - warns when the page is not served over an encrypted connection,
 * - surfaces suspicious wallet activity detected from the local security log.
 */
export default function WalletSecurityCenter() {
  const { address } = useWalletContext();
  const previousAddress = useRef<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [secretWarning, setSecretWarning] = useState<SecretKind | null>(null);
  const [insecure, setInsecure] = useState(false);
  const [alerts, setAlerts] = useState<WalletSecurityAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Security tips on login, and logging of account switches.
  useEffect(() => {
    const prev = previousAddress.current;
    previousAddress.current = address;
    if (!address) return;
    if (prev && prev !== address) {
      recordSecurityEvent({ type: "account_changed" });
    }
    if (
      !prev &&
      storageGet(() => localStorage, TIPS_DISMISSED_KEY) !== "1" &&
      storageGet(() => sessionStorage, TIPS_SHOWN_SESSION_KEY) !== "1"
    ) {
      storageSet(() => sessionStorage, TIPS_SHOWN_SESSION_KEY, "1");
      setShowTips(true);
    }
  }, [address]);

  // Warn about unencrypted connections.
  useEffect(() => {
    setInsecure(!isConnectionEncrypted(window.location, window.isSecureContext));
  }, []);

  // Detect secret keys / recovery phrases typed or pasted into any field.
  useEffect(() => {
    const flagged = new WeakMap<EventTarget, SecretKind>();

    const check = (text: string, target: EventTarget | null) => {
      const kind = detectSecretMaterial(text);
      if (!kind || !target) return;
      if (flagged.get(target) === kind) return;
      flagged.set(target, kind);
      recordSecurityEvent({ type: "secret_detected", detail: kind });
      setSecretWarning(kind);
    };

    const onPaste = (e: ClipboardEvent) => check(e.clipboardData?.getData("text") ?? "", e.target);
    const onInput = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.type === "password") return;
        check(el.value, el);
      }
    };

    document.addEventListener("paste", onPaste, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("input", onInput, true);
    };
  }, []);

  // Suspicious activity from the local security log.
  const refreshAlerts = useCallback(() => setAlerts(detectWalletAnomalies(readSecurityEvents())), []);
  useEffect(() => {
    refreshAlerts();
    window.addEventListener(SECURITY_EVENT_NAME, refreshAlerts);
    const id = setInterval(refreshAlerts, 60_000);
    return () => {
      window.removeEventListener(SECURITY_EVENT_NAME, refreshAlerts);
      clearInterval(id);
    };
  }, [refreshAlerts]);

  const closeTips = () => {
    if (dontShowAgain) storageSet(() => localStorage, TIPS_DISMISSED_KEY, "1");
    setShowTips(false);
  };

  // The secret warning already covers the "secret_detected" alert.
  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id) && a.id !== "secret_detected");

  return (
    <>
      {(insecure || visibleAlerts.length > 0) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-xl flex-col gap-2">
          {insecure && (
            <div role="alert" className="rounded-lg border border-red-700 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-lg">
              <strong>This connection is not encrypted.</strong> Don&apos;t connect a wallet or sign transactions
              unless the address bar shows https://.
            </div>
          )}
          {visibleAlerts.map((a) => (
            <div
              key={a.id}
              role="alert"
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
                a.severity === "high"
                  ? "border-red-700 bg-red-950/95 text-red-100"
                  : "border-amber-600 bg-amber-950/95 text-amber-100"
              }`}
            >
              <span aria-hidden="true">⚠</span>
              <p className="flex-1">
                <strong>Suspicious activity:</strong> {a.message}{" "}
                <Link href="/settings/security" className="underline">
                  Review
                </Link>
              </p>
              <button
                type="button"
                onClick={() => setDismissedAlerts((prev) => new Set(prev).add(a.id))}
                aria-label="Dismiss alert"
                className="shrink-0 rounded opacity-80 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {secretWarning && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="secret-warning-title"
          aria-describedby="secret-warning-body"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4"
        >
          <FocusTrap onClose={() => setSecretWarning(null)}>
            <div className="w-full max-w-md rounded-xl border border-red-700 bg-gray-900 p-6">
              <h2 id="secret-warning-title" className="text-lg font-bold text-red-400">
                ⚠ That looks like your {secretWarning === "secret_key" ? "secret key" : "recovery phrase"}
              </h2>
              <div id="secret-warning-body" className="mt-3 space-y-2 text-sm text-gray-300">
                <p>
                  StellarSplit never needs your {secretWarning === "secret_key" ? "secret key" : "recovery phrase"}.
                  Anyone who sees it can take your funds.
                </p>
                <p>Delete it from this field. If you pasted it anywhere else, move your funds to a new wallet.</p>
              </div>
              <button
                type="button"
                onClick={() => setSecretWarning(null)}
                className="mt-5 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                I understand
              </button>
            </div>
          </FocusTrap>
        </div>
      )}

      {showTips && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="security-tips-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={closeTips}
        >
          <FocusTrap onClose={closeTips}>
            <div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="security-tips-title" className="text-lg font-semibold text-white">
                🔒 Keep your wallet safe
              </h2>
              <ul className="mt-4 space-y-3">
                {SECURITY_TIPS.map((tip) => (
                  <li key={tip.id} className="rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2">
                    <p className="text-sm font-medium text-gray-100">{tip.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{tip.body}</p>
                  </li>
                ))}
              </ul>
              <label className="mt-4 flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
                Don&apos;t show these tips again
              </label>
              <div className="mt-5 flex items-center justify-between gap-3">
                <Link href="/settings/security" onClick={closeTips} className="text-sm text-indigo-400 hover:text-indigo-300">
                  Security settings
                </Link>
                <button
                  type="button"
                  onClick={closeTips}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Got it
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </>
  );
}
