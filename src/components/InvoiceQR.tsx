"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface Props {
  invoiceId: string;
}

export default function InvoiceQR({ invoiceId }: Props) {
  const qrRef = useRef<HTMLDivElement>(null);

  const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${invoiceId}`;

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${invoiceId}-qr.png`;
    link.click();
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Share Invoice</h2>
      <div className="flex flex-col items-center gap-4 bg-gray-900 rounded-lg p-6">
        <div ref={qrRef} className="bg-white p-2 rounded-lg">
          <QRCodeCanvas value={verifyUrl} size={200} level="H" includeMargin />
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
        >
          Download QR Code
        </button>
        <p className="text-xs text-gray-400 text-center">
          Scan to view invoice details
        </p>
      </div>
    </section>
  );
}
