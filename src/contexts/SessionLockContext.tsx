"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { isBiometricEnabled, verifyBiometric } from "@/lib/biometric";
import { recordSecurityEvent } from "@/lib/walletSecurity";

type TimeoutOption = 5 | 15 | 30 | 60 | null;

interface SessionLockContextValue {
  locked: boolean;
  timeoutMinutes: TimeoutOption;
  setTimeoutMinutes: (minutes: TimeoutOption) => void;
  resume: () => void;
  /** Seconds left before the session locks, or null when not in the warning window. */
  secondsUntilLock: number | null;
}

const SessionLockContext = createContext<SessionLockContextValue | undefined>(undefined);

const STORAGE_KEY = "stellarsplit_session_lock_timeout";
/** Cached wallet connection written by `useWallet`; cleared on lock so a reload needs a fresh connect. */
const WALLET_SESSION_KEY = "stellarsplit_wallet";
const INTERACTION_EVENTS: (keyof DocumentEventMap)[] = ["mousedown", "keydown", "touchstart"];
const WARNING_SECONDS = 60;
const TICK_MS = 1_000;

export const SESSION_TIMEOUT_OPTIONS: TimeoutOption[] = [5, 15, 30, 60, null];

function getStoredTimeout(): TimeoutOption {
  if (typeof window === "undefined") return 15;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "null") return null;
    const parsed = Number(raw);
    if ([5, 15, 30, 60].includes(parsed)) return parsed as TimeoutOption;
  } catch {}
  return 15;
}

/**
 * Locks the app after a period of inactivity. Shows a countdown warning in
 * the last minute, clears the cached wallet session when it locks, and — when
 * the user has enabled it — requires a biometric check to unlock.
 */
export function SessionLockProvider({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [timeoutMinutes, setTimeoutMinutesState] = useState<TimeoutOption>(getStoredTimeout);
  const [secondsUntilLock, setSecondsUntilLock] = useState<number | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [biometricRequired, setBiometricRequired] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    // Activity behind the lock screen must not silently extend the session.
    if (lockedRef.current) return;
    lastActivityRef.current = Date.now();
    setSecondsUntilLock(null);
  }, []);

  const setTimeoutMinutes = useCallback((minutes: TimeoutOption) => {
    setTimeoutMinutesState(minutes);
    try {
      localStorage.setItem(STORAGE_KEY, String(minutes));
    } catch {}
    lockedRef.current = false;
    resetActivity();
    setLocked(false);
  }, [resetActivity]);

  const resume = useCallback(() => {
    lockedRef.current = false;
    setLocked(false);
    setUnlockError(null);
    resetActivity();
  }, [resetActivity]);

  const lock = useCallback(() => {
    lockedRef.current = true;
    setLocked(true);
    setSecondsUntilLock(null);
    setBiometricRequired(isBiometricEnabled());
    try {
      sessionStorage.removeItem(WALLET_SESSION_KEY);
    } catch {}
    recordSecurityEvent({ type: "session_locked" });
  }, []);

  const unlockWithBiometric = async () => {
    setUnlocking(true);
    setUnlockError(null);
    const ok = await verifyBiometric();
    setUnlocking(false);
    if (ok) resume();
    else setUnlockError("Biometric check failed. Try again, or disconnect and sign in again.");
  };

  const disconnectAndReload = () => {
    try {
      sessionStorage.removeItem(WALLET_SESSION_KEY);
    } catch {}
    window.location.reload();
  };

  useEffect(() => {
    INTERACTION_EVENTS.forEach((evt) => document.addEventListener(evt, resetActivity, true));
    return () => {
      INTERACTION_EVENTS.forEach((evt) => document.removeEventListener(evt, resetActivity, true));
    };
  }, [resetActivity]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (timeoutMinutes === null) {
      setSecondsUntilLock(null);
      return;
    }

    const ms = timeoutMinutes * 60 * 1000;
    timerRef.current = setInterval(() => {
      if (lockedRef.current) return;
      const remaining = ms - (Date.now() - lastActivityRef.current);
      if (remaining <= 0) {
        lock();
      } else if (remaining <= WARNING_SECONDS * 1000) {
        setSecondsUntilLock(Math.ceil(remaining / 1000));
      }
    }, TICK_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeoutMinutes, lock]);

  return (
    <SessionLockContext.Provider value={{ locked, timeoutMinutes, setTimeoutMinutes, resume, secondsUntilLock }}>
      {children}
      {!locked && secondsUntilLock !== null && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-[9998] flex max-w-sm items-center gap-3 rounded-lg border border-amber-600 bg-amber-950/95 px-4 py-3 text-sm text-amber-100 shadow-lg"
        >
          <p className="flex-1">
            Your session will lock in {secondsUntilLock}s due to inactivity.
          </p>
          <button
            type="button"
            onClick={resetActivity}
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Stay signed in
          </button>
        </div>
      )}
      {locked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-locked-title"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/95 backdrop-blur"
        >
          <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4 border border-gray-800">
            <h2 id="session-locked-title" className="text-xl font-bold">Session Locked</h2>
            <p className="text-sm text-gray-400">
              Your session was locked due to inactivity.
            </p>
            {biometricRequired ? (
              <>
                <button
                  type="button"
                  onClick={unlockWithBiometric}
                  disabled={unlocking}
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {unlocking ? "Waiting for device…" : "Unlock with biometrics"}
                </button>
                {unlockError && (
                  <p role="alert" className="text-sm text-red-400">{unlockError}</p>
                )}
                <button
                  type="button"
                  onClick={disconnectAndReload}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
                >
                  Disconnect wallet
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={resume}
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
              >
                Resume
              </button>
            )}
          </div>
        </div>
      )}
    </SessionLockContext.Provider>
  );
}

export function useSessionLock() {
  const ctx = useContext(SessionLockContext);
  if (!ctx) throw new Error("useSessionLock must be used within SessionLockProvider");
  return ctx;
}
