"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "";
const POLL_MS = 60_000;

type RpcStatus = "healthy" | "degraded" | "offline" | "checking";

async function checkHealth(): Promise<RpcStatus> {
  if (!RPC_URL) return "offline";
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth", params: {} }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "offline";
    const data = await res.json();
    const s: string = data?.result?.status ?? "";
    if (s === "healthy") return "healthy";
    if (s === "degraded") return "degraded";
    return "degraded";
  } catch {
    return "offline";
  }
}

export default function NetworkStatus() {
  const [status, setStatus] = useState<RpcStatus>("checking");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const s = await checkHealth();
    setStatus(s);
    setCheckedAt(new Date());
    setSecondsAgo(0);
    if (s !== "offline") setDismissed(false);
  }, []);

  useEffect(() => {
    poll();

    const start = () => { timerRef.current = setInterval(poll, POLL_MS); };
    const stop = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

    const onVisibility = () => { document.hidden ? stop() : (poll(), start()); };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [poll]);

  useEffect(() => {
    if (!checkedAt) return;
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - checkedAt.getTime()) / 1000));
    }, 5000);
    return () => clearInterval(id);
  }, [checkedAt]);

  const dotColor =
    status === "healthy" ? "bg-green-400"
    : status === "degraded" ? "bg-yellow-400"
    : status === "offline" ? "bg-red-500"
    : "bg-gray-400 animate-pulse";

  const label =
    status === "healthy" ? "Healthy"
    : status === "degraded" ? "Degraded"
    : status === "offline" ? "Offline"
    : "Checking…";

  const tooltip = checkedAt
    ? `Soroban RPC: ${label} — last checked ${secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}`
    : "Soroban RPC: checking…";

  return (
    <>
      {status === "offline" && !dismissed && (
        <div
          role="alert"
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 bg-red-900/95 border-b border-red-700 px-4 py-2 text-sm text-red-100"
        >
          <span>Network issues detected — transactions may fail</span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 text-red-300 hover:text-white transition-colors"
            aria-label="Dismiss network warning"
          >
            ✕
          </button>
        </div>
      )}

      <div className="group relative flex items-center gap-1.5 cursor-default select-none">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
        <span className="text-xs text-gray-400 hidden sm:inline">{label}</span>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-200 shadow-lg"
        >
          {tooltip}
        </span>
      </div>
    </>
  );
}
