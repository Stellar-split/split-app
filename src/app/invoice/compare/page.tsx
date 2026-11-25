"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";
import CompareInvoicesView from "@/components/CompareInvoicesView";
import { InvoiceListSkeleton } from "@/components/Skeleton";

function CompareInvoicesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoiceA, setInvoiceA] = useState<Invoice | null>(null);
  const [invoiceB, setInvoiceB] = useState<Invoice | null>(null);
  const [batchInvoices, setBatchInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const idA = searchParams.get("a");
  const idB = searchParams.get("b");
  const batchIds = searchParams.get("ids");

  useEffect(() => {
    setError(null);
    if (batchIds !== null) {
      const ids = [...new Set(batchIds.split(",").map((id) => id.trim()).filter(Boolean))];
      if (ids.length < 2 || ids.length > 10) {
        setError("Batch comparison requires between 2 and 10 distinct invoice IDs.");
        setLoading(false);
        return;
      }
      const fetchBatch = async () => {
        try {
          setLoading(true);
          setError(null);
          const invoices = await Promise.all(ids.map((id) => splitClient.getInvoice(id)));
          setBatchInvoices(invoices);
          setInvoiceA(invoices[0]);
          setInvoiceB(invoices[1]);
        } catch (e) {
          setError(`Failed to load batch invoices: ${String(e)}`);
        } finally {
          setLoading(false);
        }
      };
      fetchBatch();
      return;
    }

    setBatchInvoices([]);
    if (!idA || !idB) {
      setError("Missing invoice IDs. Use /compare?a=[id]&b=[id]");
      setLoading(false);
      return;
    }

    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const [inv1, inv2] = await Promise.all([
          splitClient.getInvoice(idA),
          splitClient.getInvoice(idB),
        ]);
        setInvoiceA(inv1);
        setInvoiceB(inv2);
      } catch (e) {
        setError(`Failed to load invoices: ${String(e)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [idA, idB, batchIds]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-700 rounded" />
          <div className="h-4 w-full bg-gray-700 rounded" />
          <div className="h-32 w-full bg-gray-700 rounded" />
        </div>
      </main>
    );
  }

  if (error || !invoiceA || !invoiceB) {
    return (
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error || "Invoice not found"}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  const handlePayA = () => {
    router.push(`/invoice/${invoiceA!.id}`);
  };

  const comparisons = batchInvoices.length > 2
    ? batchInvoices.slice(1).map((invoice) => [batchInvoices[0], invoice] as const)
    : [[invoiceA, invoiceB] as const];

  return (
    <main className="w-full">
      {batchInvoices.length > 2 && (
        <p className="mx-auto max-w-7xl px-4 pt-6 text-sm text-gray-500 dark:text-gray-400">
          Batch comparison: invoice #{batchInvoices[0].id} is compared with {batchInvoices.length - 1} other invoices.
        </p>
      )}
      {comparisons.map(([baseline, invoice]) => (
        <CompareInvoicesView
          key={`${baseline.id}-${invoice.id}`}
          invoiceA={baseline}
          invoiceB={invoice}
          onPayA={handlePayA}
          onPayB={() => router.push(`/invoice/${invoice.id}`)}
        />
      ))}
    </main>
  );
}

export default function CompareInvoicesPage() {
  return (
    <Suspense fallback={
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-700 rounded" />
          <div className="h-4 w-full bg-gray-700 rounded" />
          <div className="h-32 w-full bg-gray-700 rounded" />
        </div>
      </main>
    }>
      <CompareInvoicesContent />
    </Suspense>
  );
}
