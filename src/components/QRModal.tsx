"use client";

import { useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";

type QRModalProps = {
  open: boolean;
  uri: string;
  onClose: () => void;
  onCopied?: () => void;
  onConnected?: () => void;
};

export default function QRModal({
  open,
  uri,
  onClose,
  onCopied,
  onConnected,
}: QRModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // If the wallet successfully connected elsewhere in the UI,
    // consumers can trigger onConnected manually. This effect is left
    // as a placeholder for future integration and does not auto-fire.
    void onConnected;
  }, [open, onConnected]);

  if (!open) return null;

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
            <div className="bg-white rounded-xl p-3 w-[260px] max-w-full">
              <QRCodeCanvas
                value={uri}
                size={240}
                level="M"
                includeMargin={false}
              />
            </div>

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
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg bg-transparent hover:bg-gray-800 border border-gray-800 text-sm font-semibold text-gray-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
