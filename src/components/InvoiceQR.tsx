"use client";

import { useRef, useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";

export const MIN_AMOUNT = 0.01;

export function clampAmount(value: number, remainingBalance: number): number {
  if (isNaN(value) || value < MIN_AMOUNT) return MIN_AMOUNT;
  if (value > remainingBalance) return remainingBalance;
  return Math.round(value * 100) / 100;
}

interface Props {
  invoiceId: string;
  remainingBalance?: number;
}

export default function InvoiceQR({ invoiceId, remainingBalance }: Props) {
  const qrRef = useRef<HTMLDivElement>(null);
  const balance = remainingBalance ?? 0;
  const [amountInput, setAmountInput] = useState(balance > 0 ? String(balance) : "");
  const [debouncedAmount, setDebouncedAmount] = useState(balance);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseFloat(amountInput);
    if (amountInput === "" || isNaN(parsed)) {
      setValidationError(amountInput === "" ? null : "Enter a valid number");
      return;
    }
    if (parsed < MIN_AMOUNT) {
      setValidationError(`Minimum amount is ${MIN_AMOUNT}`);
      return;
    }
    if (balance > 0 && parsed > balance) {
      setValidationError(`Maximum is ${balance} (remaining balance)`);
      return;
    }
    setValidationError(null);

    const timer = setTimeout(() => {
      setDebouncedAmount(clampAmount(parsed, balance > 0 ? balance : Infinity));
    }, 300);
    return () => clearTimeout(timer);
  }, [amountInput, balance]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrPayload = debouncedAmount > 0
    ? `${origin}/pay/${invoiceId}?amount=${debouncedAmount}`
    : `${origin}/verify/${invoiceId}`;

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement;
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${invoiceId}-qr.png`;
    link.click();
  };

  const handleFullAmount = () => {
    if (balance > 0) {
      setAmountInput(String(balance));
    }
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Share Invoice</h2>
      <div className="flex flex-col items-center gap-4 bg-gray-900 rounded-lg p-6">
        {balance > 0 && (
          <div className="w-full max-w-xs space-y-2">
            <label htmlFor="qr-amount" className="text-sm text-gray-400">
              Payment amount (USDC)
            </label>
            <div className="flex gap-2">
              <input
                id="qr-amount"
                type="number"
                step="0.01"
                min={MIN_AMOUNT}
                max={balance}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleFullAmount}
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs hover:bg-gray-700 transition-colors"
              >
                Full
              </button>
            </div>
            {validationError && (
              <p className="text-xs text-red-400">{validationError}</p>
            )}
          </div>
        )}

        <div ref={qrRef} className="bg-white p-2 rounded-lg">
          <QRCodeCanvas value={qrPayload} size={200} level="H" includeMargin />
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
