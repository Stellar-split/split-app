"use client";

import { useEffect, useRef, useState } from "react";
import FocusTrap from "./FocusTrap";
import { getActiveNetwork } from "@/lib/networks";

const EXPLORER_BASE =
  getActiveNetwork().explorerTxBase;

interface Props {
  txHash?: string;
  action: string;
  onClose: () => void;
  /** When true, the modal shows a pre-signing state prompting the user to confirm on their Ledger device. */
  awaitingDevice?: boolean;
  /** Optional human-readable summary of the transaction shown while awaiting device confirmation. */
  txSummary?: string;
}

export default function TxConfirmModal({
  txHash,
  action,
  onClose,
  awaitingDevice = false,
  txSummary,
}: Props) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus trap and Escape handled by FocusTrap

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
    } catch {
      return;
    }
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
      onClick={onClose}
    >
      <FocusTrap onClose={onClose}>
        <div
          className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="tx-modal-title"
            className={`text-lg font-semibold ${awaitingDevice ? "text-indigo-400" : "text-green-400"}`}
          >
            {awaitingDevice ? "Confirm on your Ledger device" : `✓ ${action} confirmed`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {awaitingDevice ? (
          <>
            <p className="text-sm text-gray-400 mb-2">
              Review and approve this transaction on your Ledger device.
            </p>
            {txSummary && (
              <div className="bg-gray-800 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs text-gray-400 mb-1">Transaction summary</p>
                <p className="text-sm text-gray-200 break-words whitespace-pre-wrap">{txSummary}</p>
              </div>
            )}
            <div
              className="flex items-center gap-2 text-sm text-indigo-300"
              role="status"
              aria-live="polite"
            >
              <span
                className="inline-block h-3 w-3 rounded-full bg-indigo-400 animate-pulse"
                aria-hidden="true"
              />
              Waiting for device confirmation…
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-2">Transaction hash</p>
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-4">
              <span className="font-mono text-xs text-gray-200 break-all flex-1">{txHash}</span>
              <button
                onClick={handleCopy}
                className="shrink-0 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Copy transaction hash"
                aria-live="polite"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {txHash && (
              <a
                href={`${EXPLORER_BASE}/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                View on Stellar Expert ↗
              </a>
            )}
          </>
        )}
        </div>
      </FocusTrap>
    </div>
  );
}
