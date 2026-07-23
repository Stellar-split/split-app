"use client";

import { QRCodeCanvas } from "qrcode.react";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice, Recipient } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  total: bigint;
  verifyUrl: string;
}

export default function PaymentCertificate({ invoice, total, verifyUrl }: Props) {
  const releaseDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(invoice.deadline * 1000));

  return (
    <div className="hidden print:block w-full bg-white text-black p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
          <h1 className="text-3xl font-bold mb-2">Payment Certificate</h1>
          <p className="text-gray-600">Invoice #{invoice.id}</p>
        </div>

        {/* Certificate Details */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-sm text-gray-600 font-semibold">Invoice ID</p>
            <p className="text-lg font-mono">{invoice.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-semibold">Status</p>
            <p className="text-lg font-semibold text-green-600">{invoice.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-semibold">Creator</p>
            <p className="text-sm font-mono break-all">{invoice.creator}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-semibold">Release Date</p>
            <p className="text-lg">{releaseDate}</p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-gray-600 font-semibold">Total Amount</p>
            <p className="text-2xl font-bold text-indigo-600">{formatAmount(total)} USDC</p>
          </div>
        </div>

        {/* Recipients */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b-2 border-gray-300 pb-2">Recipients</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 font-semibold">Address</th>
                <th className="text-right py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.recipients.map((r: Recipient, i: number) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-2 font-mono text-xs break-all">{r.address}</td>
                  <td className="text-right py-2 font-semibold">{formatAmount(r.amount)} USDC</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payments */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b-2 border-gray-300 pb-2">Payments Received</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 font-semibold">Payer</th>
                <th className="text-right py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-2 font-mono text-xs break-all">{p.payer}</td>
                  <td className="text-right py-2 font-semibold">{formatAmount(p.amount)} USDC</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center mb-8 pt-8 border-t-2 border-gray-300">
          <p className="text-sm text-gray-600 font-semibold mb-4">Verification QR Code</p>
          <QRCodeCanvas value={verifyUrl} size={200} level="H" includeMargin />
          <p className="text-xs text-gray-600 mt-4 text-center">Scan to verify this certificate</p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 border-t-2 border-gray-300 pt-6">
          <p>This certificate confirms payment completion for the above invoice.</p>
          <p className="mt-2">Generated on {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
