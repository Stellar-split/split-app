"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export type WalletErrorType =
  | "not_installed"
  | "locked"
  | "rejected"
  | "network_mismatch"
  | null;

interface Props {
  errorType: WalletErrorType;
  onDismiss: () => void;
  onRetry: () => void;
  expectedNetwork?: string;
}

const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";

function NotInstalledContent({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <span className="text-4xl" aria-hidden="true">🧩</span>
        <h2 className="text-lg font-bold text-white">Freighter Not Installed</h2>
        <p className="text-sm text-slate-400">
          Freighter is a browser extension that acts as your Stellar wallet.
          Install it to connect and start using StellarSplit.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <a
          href={FREIGHTER_INSTALL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
        >
          Install Freighter
          <span aria-hidden="true">↗</span>
        </a>
        <button
          onClick={onDismiss}
          className="w-full h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-sm font-medium transition-colors"
        >
          Dismiss
        </button>
      </div>
      {/* Mobile QR hint */}
      <p className="text-xs text-slate-500 text-center mt-4">
        On mobile? Search <span className="text-slate-300 font-medium">Freighter</span> in your browser&apos;s extension store.
      </p>
    </>
  );
}

function LockedContent({ onRetry, onDismiss }: { onRetry: () => void; onDismiss: () => void }) {
  return (
    <>
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <span className="text-4xl" aria-hidden="true">🔒</span>
        <h2 className="text-lg font-bold text-white">Freighter is Locked</h2>
        <p className="text-sm text-slate-400">
          Your Freighter wallet is locked. Unlock it first, then try connecting again.
        </p>
      </div>
      <ol className="text-sm text-slate-400 space-y-2 mb-6 text-left">
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600/30 text-brand-300 text-xs flex items-center justify-center font-bold">1</span>
          Click the Freighter icon in your browser toolbar.
        </li>
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600/30 text-brand-300 text-xs flex items-center justify-center font-bold">2</span>
          Enter your Freighter password to unlock.
        </li>
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600/30 text-brand-300 text-xs flex items-center justify-center font-bold">3</span>
          Return here and click <span className="text-white font-medium">Try Again</span>.
        </li>
      </ol>
      <div className="flex flex-col gap-3">
        <button
          onClick={onRetry}
          className="w-full h-10 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={onDismiss}
          className="w-full h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function NetworkMismatchContent({
  expectedNetwork,
  onDismiss,
}: {
  expectedNetwork: string;
  onDismiss: () => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <span className="text-4xl" aria-hidden="true">🌐</span>
        <h2 className="text-lg font-bold text-white">Wrong Network</h2>
        <p className="text-sm text-slate-400">
          StellarSplit is running on{" "}
          <span className="text-white font-semibold">{expectedNetwork}</span>. Switch your
          Freighter wallet to the same network to continue.
        </p>
      </div>
      <ol className="text-sm text-slate-400 space-y-2 mb-6 text-left">
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600/30 text-brand-300 text-xs flex items-center justify-center font-bold">1</span>
          Open Freighter and go to <span className="text-white font-medium">Settings</span>.
        </li>
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600/30 text-brand-300 text-xs flex items-center justify-center font-bold">2</span>
          Select <span className="text-white font-medium">Network</span> and choose{" "}
          <span className="text-white font-medium">{expectedNetwork}</span>.
        </li>
        <li className="flex gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600/30 text-brand-300 text-xs flex items-center justify-center font-bold">3</span>
          Return here and reconnect your wallet.
        </li>
      </ol>
      <button
        onClick={onDismiss}
        className="w-full h-10 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
      >
        Got it
      </button>
    </>
  );
}

export default function WalletErrorModal({
  errorType,
  onDismiss,
  onRetry,
  expectedNetwork = "Testnet",
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!errorType) return;
    // focus first interactive element
    const el = overlayRef.current?.querySelector<HTMLElement>(
      "button, a[href]"
    );
    if (el) {
      firstFocusRef.current = document.activeElement as HTMLElement;
      el.focus();
    }
    return () => {
      firstFocusRef.current?.focus();
    };
  }, [errorType]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onDismiss]);

  if (!errorType) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-error-title"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <div
        ref={overlayRef}
        className="w-full max-w-sm bg-surface-800 rounded-2xl border border-white/[0.08] p-6 shadow-2xl"
      >
        <span id="wallet-error-title" className="sr-only">
          Wallet connection error
        </span>

        {errorType === "not_installed" && (
          <NotInstalledContent onDismiss={onDismiss} />
        )}
        {errorType === "locked" && (
          <LockedContent onRetry={onRetry} onDismiss={onDismiss} />
        )}
        {errorType === "network_mismatch" && (
          <NetworkMismatchContent
            expectedNetwork={expectedNetwork}
            onDismiss={onDismiss}
          />
        )}
      </div>
    </div>
  );
}
