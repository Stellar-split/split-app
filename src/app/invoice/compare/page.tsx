"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { splitClient } from "@/lib/stellar";
import { formatAmount, truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";

export default function CompareInvoicesPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-16 text-gray-400">Loading…</div>}>
      <CompareInvoicesContent />
    </Suspense>
  );
}

function CompareInvoicesContent() {
  const searchParams = useSearchParams();
  const [id1, setId1] = useState(searchParams.get("id1") || "");
  const [id2, setId2] = useState(searchParams.get("id2") || "");
  const [invoice1, setInvoice1] = useState<Invoice | null>(null);
  const [invoice2, setInvoice2] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    if (!id1 || !id2) {
      setError("Please enter both invoice IDs");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [inv1, inv2] = await Promise.all([
        splitClient.getInvoice(id1),
        splitClient.getInvoice(id2),
      ]);
      setInvoice1(inv1);
      setInvoice2(inv2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  const isDifferent = (val1: any, val2: any): boolean => {
    if (typeof val1 === "bigint" && typeof val2 === "bigint") {
      return val1 !== val2;
    }
    return JSON.stringify(val1) !== JSON.stringify(val2);
  };

  const highlightClass = (val1: any, val2: any) =>
    isDifferent(val1, val2) ? "bg-yellow-100" : "";

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Compare Invoices</h1>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Invoice ID 1"
              value={id1}
              onChange={(e) => setId1(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Invoice ID 2"
              value={id2}
              onChange={(e) => setId2(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? "Loading..." : "Compare"}
          </button>
          {error && <p className="text-red-600 mt-4">{error}</p>}
        </div>

        {/* Comparison Grid */}
        {invoice1 && invoice2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoice 1 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Invoice {id1}</h2>
              <div className="space-y-3 text-sm">
                <div className={`p-2 rounded ${highlightClass(invoice1.id, invoice2.id)}`}>
                  <span className="font-semibold">ID:</span> {invoice1.id}
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice1.status, invoice2.status)}`}>
                  <span className="font-semibold">Status:</span> {invoice1.status}
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice1.creator, invoice2.creator)}`}>
                  <span className="font-semibold">Creator:</span> {truncateAddress(invoice1.creator)}
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice1.funded, invoice2.funded)}`}>
                  <span className="font-semibold">Funded:</span> {formatAmount(invoice1.funded)} USDC
                </div>
                <div className={`p-2 rounded ${highlightClass(
                  invoice1.recipients.reduce((s, r) => s + r.amount, 0n),
                  invoice2.recipients.reduce((s, r) => s + r.amount, 0n)
                )}`}>
                  <span className="font-semibold">Total:</span>{" "}
                  {formatAmount(invoice1.recipients.reduce((s, r) => s + r.amount, 0n))} USDC
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice1.deadline, invoice2.deadline)}`}>
                  <span className="font-semibold">Deadline:</span>{" "}
                  {new Date(invoice1.deadline * 1000).toLocaleDateString()}
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice1.recipients.length, invoice2.recipients.length)}`}>
                  <span className="font-semibold">Recipients:</span> {invoice1.recipients.length}
                </div>
              </div>
            </div>

            {/* Invoice 2 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Invoice {id2}</h2>
              <div className="space-y-3 text-sm">
                <div className={`p-2 rounded ${highlightClass(invoice2.id, invoice1.id)}`}>
                  <span className="font-semibold">ID:</span> {invoice2.id}
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice2.status, invoice1.status)}`}>
                  <span className="font-semibold">Status:</span> {invoice2.status}
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice2.creator, invoice1.creator)}`}>
                  <span className="font-semibold">Creator:</span> {truncateAddress(invoice2.creator)}
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice2.funded, invoice1.funded)}`}>
                  <span className="font-semibold">Funded:</span> {formatAmount(invoice2.funded)} USDC
                </div>
                <div className={`p-2 rounded ${highlightClass(
                  invoice2.recipients.reduce((s, r) => s + r.amount, 0n),
                  invoice1.recipients.reduce((s, r) => s + r.amount, 0n)
                )}`}>
                  <span className="font-semibold">Total:</span>{" "}
                  {formatAmount(invoice2.recipients.reduce((s, r) => s + r.amount, 0n))} USDC
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice2.deadline, invoice1.deadline)}`}>
                  <span className="font-semibold">Deadline:</span>{" "}
                  {new Date(invoice2.deadline * 1000).toLocaleDateString()}
                </div>
                <div className={`p-2 rounded ${highlightClass(invoice2.recipients.length, invoice1.recipients.length)}`}>
                  <span className="font-semibold">Recipients:</span> {invoice2.recipients.length}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
