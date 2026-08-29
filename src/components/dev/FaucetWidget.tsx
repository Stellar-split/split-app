"use client";

import { useEffect, useState } from "react";
import { Droplet, Loader2, X } from "lucide-react";
import { useWalletContext } from "@/contexts/WalletContext";
import { apiFetch } from "@/lib/apiClient";

const DISMISS_KEY = "split-faucet-widget-dismissed";

const isTestnetDevBuild =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet";

type FaucetState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "funded"; xlm: string | null }
  | { status: "already-funded"; message: string }
  | { status: "error"; message: string };

/**
 * Dev-mode widget that funds the connected wallet via the Stellar testnet
 * Friendbot, proxied through /api/dev/faucet to avoid CORS. Absent entirely
 * from production builds — see the `isTestnetDevBuild` guard below, which
 * is evaluated at build time so the branch (and this component's code) is
 * dropped from the production bundle.
 */
export default function FaucetWidget() {
  const { address } = useWalletContext();
  const [dismissed, setDismissed] = useState(true);
  const [state, setState] = useState<FaucetState>({ status: "idle" });

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (!isTestnetDevBuild || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const fund = async () => {
    if (!address) {
      setState({ status: "error", message: "Connect a wallet first" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await apiFetch("/api/dev/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: address }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState({ status: "error", message: data.error ?? "Faucet request failed" });
        return;
      }

      if (data.alreadyFunded) {
        setState({ status: "already-funded", message: data.message ?? "This account is already funded." });
        return;
      }

      setState({ status: "funded", xlm: data.xlm ?? null });
    } catch {
      setState({ status: "error", message: "Could not reach the faucet" });
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 flex flex-wrap items-center gap-3">
      <Droplet size={18} className="text-indigo-400 shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium text-indigo-200">Testnet faucet</p>
        {state.status === "idle" && (
          <p className="text-indigo-300/80">Fund your connected wallet with test XLM.</p>
        )}
        {state.status === "funded" && (
          <p className="text-indigo-300/80">
            Funded{state.xlm ? ` — balance is now ${state.xlm} XLM` : ""}.
          </p>
        )}
        {state.status === "already-funded" && <p className="text-indigo-300/80">{state.message}</p>}
        {state.status === "error" && <p className="text-red-300">{state.message}</p>}
      </div>
      <button
        type="button"
        onClick={fund}
        disabled={state.status === "loading" || !address}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shrink-0"
      >
        {state.status === "loading" && <Loader2 size={14} className="animate-spin" />}
        Fund with Friendbot
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss faucet widget"
        className="p-1 rounded text-indigo-300/70 hover:text-indigo-100 hover:bg-indigo-500/20 transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
