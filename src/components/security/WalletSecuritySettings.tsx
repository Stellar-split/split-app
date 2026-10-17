"use client";

import { useEffect, useState } from "react";
import { SESSION_TIMEOUT_OPTIONS, useSessionLock } from "@/contexts/SessionLockContext";
import {
  disableBiometric,
  enableBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
} from "@/lib/biometric";
import {
  SECURITY_EVENT_NAME,
  SECURITY_TIPS,
  clearSecurityEvents,
  readSecurityEvents,
  type SecurityEvent,
  type SecurityEventType,
} from "@/lib/walletSecurity";
import { TIPS_DISMISSED_KEY } from "@/components/security/WalletSecurityCenter";

const EVENT_LABELS: Record<SecurityEventType, string> = {
  connect_failed: "Wallet connection failed",
  sign_rejected: "Signing request rejected or failed",
  account_changed: "Connected account changed",
  secret_detected: "Secret key or recovery phrase entered",
  rate_limited: "Wallet action rate limited",
  session_locked: "Session locked after inactivity",
};

/**
 * WalletSecuritySettings — session timeout, optional biometric unlock,
 * security tips and the recent security event log on /settings/security.
 */
export default function WalletSecuritySettings() {
  const { timeoutMinutes, setTimeoutMinutes } = useSessionLock();
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);
  const [biometricOn, setBiometricOn] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
    setBiometricOn(isBiometricEnabled());
    const refresh = () => setEvents(readSecurityEvents().slice(-20).reverse());
    refresh();
    window.addEventListener(SECURITY_EVENT_NAME, refresh);
    return () => window.removeEventListener(SECURITY_EVENT_NAME, refresh);
  }, []);

  const toggleBiometric = async () => {
    setBiometricMessage(null);
    if (biometricOn) {
      disableBiometric();
      setBiometricOn(false);
      setBiometricMessage("Biometric unlock turned off.");
      return;
    }
    setBiometricBusy(true);
    try {
      await enableBiometric();
      setBiometricOn(true);
      setBiometricMessage("Biometric unlock is on. You'll be asked to verify when your session locks.");
    } catch (e) {
      setBiometricMessage(e instanceof Error ? e.message : "Couldn't set up biometric unlock.");
    } finally {
      setBiometricBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6 shadow-xl" aria-labelledby="wallet-security-heading">
      <h2 id="wallet-security-heading" className="text-xl font-semibold">Wallet security</h2>
      <p className="mt-1 text-sm text-gray-400">Protect your session when you step away from this device.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
          <label htmlFor="session-timeout" className="text-sm font-medium text-gray-200">
            Lock after inactivity
          </label>
          <p className="mt-1 text-xs text-gray-400">
            You&apos;ll get a warning a minute before. Locking also forgets the cached wallet session, so a reload
            needs a fresh connection.
          </p>
          <select
            id="session-timeout"
            value={timeoutMinutes === null ? "never" : String(timeoutMinutes)}
            onChange={(e) =>
              setTimeoutMinutes(e.target.value === "never" ? null : (Number(e.target.value) as 5 | 15 | 30 | 60))
            }
            className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          >
            {SESSION_TIMEOUT_OPTIONS.map((opt) => (
              <option key={String(opt)} value={opt === null ? "never" : String(opt)}>
                {opt === null ? "Never (not recommended)" : `${opt} minutes`}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <span id="biometric-label" className="text-sm font-medium text-gray-200">Biometric unlock</span>
            <button
              type="button"
              role="switch"
              aria-checked={biometricOn}
              aria-labelledby="biometric-label"
              aria-describedby="biometric-help"
              onClick={toggleBiometric}
              disabled={biometricBusy || (!biometricOn && biometricAvailable === false)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 ${
                biometricOn ? "bg-indigo-600" : "bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  biometricOn ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <p id="biometric-help" className="mt-1 text-xs text-gray-400">
            {biometricAvailable === false
              ? "No fingerprint, face or Windows Hello sensor was found on this device."
              : "Optional. Require Touch ID, Face ID, Windows Hello or fingerprint to unlock a locked session. This stays on this device."}
          </p>
          {biometricMessage && (
            <p role="status" className="mt-2 text-xs text-gray-300">{biometricMessage}</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-gray-200">Security tips</h3>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(TIPS_DISMISSED_KEY);
              } catch {}
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Show tips on next login
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {SECURITY_TIPS.map((tip) => (
            <li key={tip.id} className="text-sm">
              <span className="font-medium text-gray-200">{tip.title}.</span>{" "}
              <span className="text-gray-400">{tip.body}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-gray-200">Recent security activity</h3>
          {events.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearSecurityEvents();
                setEvents([]);
              }}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </div>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No security events recorded on this device.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-800">
            {events.map((e, i) => (
              <li key={`${e.timestamp}-${i}`} className="flex justify-between gap-3 py-2 text-sm">
                <span className="text-gray-300">{EVENT_LABELS[e.type] ?? e.type}</span>
                <time dateTime={new Date(e.timestamp).toISOString()} className="shrink-0 text-xs text-gray-500">
                  {new Date(e.timestamp).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
