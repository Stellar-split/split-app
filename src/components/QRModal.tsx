"use client";

import { useEffect, useRef } from "react";
import FocusTrap from "./FocusTrap";
import { QRCodeCanvas } from "qrcode.react";

export type WalletConnectStatus =
  | "idle"
  | "connecting"
  | "awaiting_scan"
  | "session_approved"
  | "timeout"
  | "error";

type QRModalProps = {
  open: boolean;
  uri: string;
  status?: WalletConnectStatus;
  errorMessage?: string;
  onClose: () => void;
  onCopied?: () => void;
  onRetry?: () => void;
  onConnected?: () => void;
};

const STATUS_TEXT: Record<WalletConnectStatus, string> = {
  idle: "Preparing connection…",
  connecting: "Connecting to WalletConnect…",
  awaiting_scan: "Waiting for wallet to scan and approve…",
  session_approved: "Session approved. Closing…",
  timeout: "Connection timed out. The QR code may have expired.",
  error: "Something went wrong while connecting.",
};

export default function QRModal({
  open,
  uri,
  status = "awaiting_scan",
  errorMessage,
  onClose,
  onCopied,
  onRetry,
  onConnected,
}: QRModalProps) {
  const firedRef = useRef(false);

  // Close the modal once the parent reports a successful session approval.
  useEffect(() => {
    if (!open) {
      firedRef.current = false;
      return;
    }
    if (status === "session_approved" && !firedRef.current) {
      firedRef.current = true;
      onConnected?.();
      onClose();
    }
  }, [open, status, onConnected, onClose]);

  if (!open) return null;

  const isBusy = status === "idle" || status === "connecting";
  const isAwaiting = status === "awaiting_scan";
  const isTimeout = status === "timeout";
  const isError = status === "error";
  const canShowQR = !!uri && !isTimeout && !isError;
  const statusText = isError && errorMessage ? errorMessage : STATUS_TEXT[status];
======

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(uri);
      onCopied?.();
    } catch (e) {
      console.error(e);
      // Fallback: best-effort prompt
      try {
        window.prompt("Copy URI:", uri);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:w-[420px] bg-gray-900 rounded-2xl shadow-xl border border-gray-800"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">
            Scan to connect
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-300"
            aria-label="Close QR modal"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-5">
          <div className="flex flex-col items-center gap-4">
            {canShowQR ? (
              <div className="relative bg-white rounded-xl p-3 w-[260px] max-w-full">
                <QRCodeCanvas
                  value={uri}
                  size={240}
                  level="M"
                  includeMargin={false}
                />
                {(isBusy || isAwaiting) && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70">
                    <span
                      className="h-8 w-8 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-[264px] w-[260px] max-w-full items-center justify-center rounded-xl border border-gray-800 bg-gray-950 px-4 text-center">
                <p className="text-sm text-gray-300">{statusText}</p>
              </div>
            )}

            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-xs text-gray-400"
            >
              {(isBusy || isAwaiting) && (
                <span
                  className="h-3 w-3 animate-spin rounded-full border border-gray-500 border-t-transparent"
                  aria-hidden="true"
                />
              )}
              <span>{statusText}</span>
            </div>

            {canShowQR && (
              <div className="w-full">
                <button
                  onClick={handleCopy}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-colors"
                >
                  Copy URI
                </button>

                <p className="mt-3 text-xs text-gray-400 break-all font-mono">
                  {uri}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex flex-col gap-2">
          {(isTimeout || isError) && onRetry && (
            <button
              onClick={onRetry}
              className="w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors"
            >
              Retry
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg bg-transparent hover:bg-gray-800 border border-gray-800 text-sm font-semibold text-gray-200 transition-colors"
          >
            {isTimeout || isError ? "Cancel" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
