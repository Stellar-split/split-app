"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { useWalletConnect } from "../hooks/useWalletConnect";

const POLL_MS = 60_000;

type RpcStatus = "healthy" | "degraded" | "offline" | "checking";

async function checkHealth(rpcUrl: string): Promise<RpcStatus> {
  if (!rpcUrl) return "offline";
  try {
    const res = await fetch(rpcUrl, {
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

/**
 * NetworkStatus
 *
 * Renders an RPC health indicator (●) in the navbar showing healthy /
 * degraded / offline status for the active network's Soroban RPC. The
 * network itself is shown and switched by `NetworkSelector`.
 *
 * When the RPC is offline a dismissible banner is also shown at the top of the
 * page.
 */
export default function NetworkStatus() {
  const [status, setStatus] = useState<RpcStatus>("checking");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { lowBalance, lowBalanceAssets } = useWalletBalance();
  const { status: wcStatus } = useWalletConnect();

  const poll = useCallback(async () => {
    const s = await checkHealth(getActiveNetwork().rpcUrl);
    setStatus((prev) => {
      if (prev === "offline" && s !== "offline") {
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 4000);
      }
      return s;
    });
    setCheckedAt(new Date());
    setSecondsAgo(0);
    if (s !== "offline") setDismissed(false);
  }, []);

  useEffect(() => {
    poll();

    const start = () => {
      timerRef.current = setInterval(poll, POLL_MS);
    };
    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const onVisibility = () => {
      document.hidden ? stop() : (poll(), start());
    };
    const onOnline = () => {
      setBrowserOffline(false);
      poll();
    };
    const onOffline = () => {
      setBrowserOffline(true);
      setStatus("offline");
      setCheckedAt(new Date());
      setDismissed(false);
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [poll]);

  useEffect(() => {
    if (!checkedAt) return;
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - checkedAt.getTime()) / 1000));
    }, 5000);
    return () => clearInterval(id);
  }, [checkedAt]);

  // ── RPC health indicator styles ─────────────────────────────────────────────

  const dotColor =
    status === "healthy"
      ? "bg-green-400"
      : status === "degraded"
      ? "bg-yellow-400"
      : status === "offline"
      ? "bg-red-500"
      : "bg-gray-400 animate-pulse";

  const healthLabel =
    status === "healthy"
      ? "Healthy"
      : status === "degraded"
      ? "Degraded"
      : status === "offline"
      ? "Offline"
      : "Checking…";

  const rpcTooltip = checkedAt
    ? `Soroban RPC: ${healthLabel} — last checked ${
        secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`
      }`
    : "Soroban RPC: checking…";

  // ── WalletConnect connection indicator styles ───────────────────────────────

  const wcConnected = wcStatus === "connected";
  const wcPending = wcStatus === "connecting" || wcStatus === "pairing";

  const wcDotColor = wcConnected
    ? "bg-blue-400"
    : wcPending
    ? "bg-blue-400 animate-pulse"
    : wcStatus === "error" || wcStatus === "disconnected"
    ? "bg-gray-500"
    : "bg-gray-400";

  const wcLabel = wcConnected
    ? "Wallet connected"
    : wcPending
    ? "Connecting…"
    : wcStatus === "error"
    ? "Wallet error"
    : "Wallet disconnected";

  const wcTooltip = `WalletConnect: ${wcLabel}`;

  // ── Low balance warning styles ──────────────────────────────────────────────

  const lowBalanceTooltip =
    lowBalanceAssets && lowBalanceAssets.length > 0
      ? `Low balance: ${lowBalanceAssets.join(", ")}`
      : "One or more token balances are low";

  // ── Network badge styles ─────────────────────────────────────────────────────

  const networkBadgeClasses =
    NETWORK === "Mainnet"
      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
      : NETWORK === "Testnet"
      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
      : "bg-gray-500/15 border-gray-500/40 text-gray-400";

  const networkIcon =
    NETWORK === "Mainnet" ? "🌐" : NETWORK === "Testnet" ? "🧪" : "❓";

  const networkTooltip =
    NETWORK === "Mainnet"
      ? "Connected to Stellar Mainnet — real assets"
      : NETWORK === "Testnet"
      ? "Connected to Stellar Testnet — test assets only"
      : "Network unknown — check NEXT_PUBLIC_STELLAR_NETWORK";

  return (
    <>
      {/* ── Offline banner ── */}
      {status === "offline" && !dismissed && (
        <div
          role="alert"
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 bg-red-900/95 border-b border-red-700 px-4 py-2 text-sm text-red-100"
        >
          <span>
            {browserOffline
              ? "You are offline — transactions may fail"
              : "Network issues detected — transactions may fail"}
            <span className="ml-1 opacity-75">({getActiveNetwork().label})</span>
          </span>
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

      {/* ── "Back online" banner ── */}
      {status !== "offline" && justReconnected && (
        <div
          role="status"
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-green-900/95 border-b border-green-700 px-4 py-2 text-sm text-green-100"
        >
          Back online
        </div>
      )}

      {/* ── Network badge + RPC health + WalletConnect + low balance ── */}
      <div className="flex items-center gap-2">
        {/* Low balance warning badge */}
        {lowBalance && (
          <div className="group relative">
            <span
              className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-xs font-semibold tracking-wide text-orange-300 select-none"
              role="status"
              aria-label="Low balance warning"
            >
              <span aria-hidden="true">⚠️</span>
              <span className="hidden sm:inline">Low balance</span>
            </span>
            {/* Tooltip */}
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-200 shadow-lg"
            >
              {lowBalanceTooltip}
            </span>
          </div>
        )}

        {/* Permanent Mainnet / Testnet badge */}
        <div className="group relative">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide select-none ${networkBadgeClasses}`}
            aria-label={`Network: ${NETWORK}`}
          >
            <span aria-hidden="true">{networkIcon}</span>
            <span className="hidden sm:inline">{NETWORK}</span>
          </span>
          {/* Tooltip */}
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-200 shadow-lg"
          >
            {networkTooltip}
          </span>
        </div>

        {/* RPC health dot */}
        <div className="group relative flex items-center gap-1.5 cursor-default select-none">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotColor}`}
            aria-hidden="true"
          />
          <span className="text-xs text-gray-400 hidden sm:inline">{healthLabel}</span>
          {/* Tooltip */}
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-200 shadow-lg"
          >
            {rpcTooltip}
          </span>
        </div>

        {/* WalletConnect connection dot */}
        <div className="group relative flex items-center gap-1.5 cursor-default select-none">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${wcDotColor}`}
            aria-hidden="true"
          />
          <span className="text-xs text-gray-400 hidden sm:inline">{wcLabel}</span>
          {/* Tooltip */}
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-200 shadow-lg"
          >
            {wcTooltip}
          </span>
        </div>
      </div>
    </>
  );
}
