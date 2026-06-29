"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import FocusTrap from "./FocusTrap";
import { useToast } from "@/contexts/ToastContext";

// Lazy load QRCodeCanvas to satisfy client-side lazy-loading criteria
const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeCanvas),
  { ssr: false }
);

interface Props {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
}

export default function InvoiceShareQRModal({ open, invoiceId, onClose }: Props) {
  const toast = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${origin}/invoice/${invoiceId}/preview`;

  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("QR code not ready for download.");
      return;
    }

    try {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoiceId}-qr.png`;
      link.click();
      toast.success("QR code downloaded successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to download QR code.");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success("Public invoice preview link copied!");
    } catch (e) {
      console.error(e);
      try {
        window.prompt("Copy link:", previewUrl);
        toast.success("Link shown in prompt!");
      } catch {
        toast.error("Failed to copy link.");
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <FocusTrap onClose={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          className="w-full sm:w-[420px] bg-gray-900 rounded-2xl shadow-xl border border-gray-800 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-200">
              Share via QR Code
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-300 transition-colors"
              aria-label="Close share QR modal"
            >
              ✕
            </button>
          </div>

          {/* QR Code Body */}
          <div className="px-4 py-6 flex flex-col items-center gap-6">
            <div
              ref={canvasRef}
              className="bg-white p-3 rounded-xl shadow-inner flex items-center justify-center"
              style={{ width: "264px", height: "264px" }}
            >
              <QRCodeCanvas
                value={previewUrl}
                size={240}
                level="Q" // High level allows for logo excavation
                includeMargin={false}
                imageSettings={{
                  src: "/icons/icon-192.png",
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>

            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-600/10"
              >
                Download QR
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold text-gray-200 transition-colors border border-gray-700"
              >
                Copy Link
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-800 bg-gray-950/20">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-lg bg-transparent hover:bg-gray-800 border border-gray-850 text-sm font-semibold text-gray-400 hover:text-gray-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
