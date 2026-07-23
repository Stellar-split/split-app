"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

type TimeoutOption = 5 | 15 | 30 | 60 | null;

interface SessionLockContextValue {
  locked: boolean;
  timeoutMinutes: TimeoutOption;
  setTimeoutMinutes: (minutes: TimeoutOption) => void;
  resume: () => void;
}

const SessionLockContext = createContext<SessionLockContextValue | undefined>(undefined);

const STORAGE_KEY = "stellarsplit_session_lock_timeout";
const INTERACTION_EVENTS: (keyof DocumentEventMap)[] = ["mousedown", "keydown", "touchstart"];

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

export function SessionLockProvider({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [timeoutMinutes, setTimeoutMinutesState] = useState<TimeoutOption>(getStoredTimeout);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const setTimeoutMinutes = useCallback((minutes: TimeoutOption) => {
    setTimeoutMinutesState(minutes);
    try {
      localStorage.setItem(STORAGE_KEY, String(minutes));
    } catch {}
    resetActivity();
    setLocked(false);
  }, [resetActivity]);

  const resume = useCallback(() => {
    setLocked(false);
    resetActivity();
  }, [resetActivity]);

  useEffect(() => {
    INTERACTION_EVENTS.forEach((evt) => document.addEventListener(evt, resetActivity, true));
    return () => {
      INTERACTION_EVENTS.forEach((evt) => document.removeEventListener(evt, resetActivity, true));
    };
  }, [resetActivity]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (timeoutMinutes === null) return;

    const ms = timeoutMinutes * 60 * 1000;
    timerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= ms) {
        setLocked(true);
      }
    }, 10_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeoutMinutes]);

  return (
    <SessionLockContext.Provider value={{ locked, timeoutMinutes, setTimeoutMinutes, resume }}>
      {children}
      {locked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950/95 backdrop-blur">
          <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4 border border-gray-800">
            <h2 className="text-xl font-bold">Session Locked</h2>
            <p className="text-sm text-gray-400">
              Your session was locked due to inactivity.
            </p>
            <button
              type="button"
              onClick={resume}
              className="w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
            >
              Resume
            </button>
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
