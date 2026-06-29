"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";
import CompareInvoicesView from "@/components/CompareInvoicesView";
import { InvoiceListSkeleton } from "@/components/Skeleton";

export default function CompareInvoicesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoiceA, setInvoiceA] = useState<Invoice | null>(null);
  const [invoiceB, setInvoiceB] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const idA = searchParams.get("a");
  const idB = searchParams.get("b");

  useEffect(() => {
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
  }, [idA, idB]);

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

  const handlePayB = () => {
    router.push(`/invoice/${invoiceB!.id}`);
  };

  return (
    <main className="w-full">
      <CompareInvoicesView
        invoiceA={invoiceA}
        invoiceB={invoiceB}
        onPayA={handlePayA}
        onPayB={handlePayB}
      />
    </main>
  );
}
