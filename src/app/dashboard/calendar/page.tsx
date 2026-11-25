"use client";

import { useEffect, useState } from "react";
import type { Invoice } from "@stellar-split/sdk";
import { splitClient } from "@/lib/stellar";
import { getFreighterPublicKey } from "@/lib/freighter";
import InvoiceCalendar from "@/components/InvoiceCalendar";

export default function InvoiceCalendarPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const pk = await getFreighterPublicKey().catch(() => null);
        if (!pk) {
          setError("Connect your wallet to view your invoice calendar.");
          return;
        }
        // as any: getInvoicesByCreator is not yet declared in the published @stellar-split/sdk types
        const result: Invoice[] = (await (splitClient as any).getInvoicesByCreator(pk)) ?? [];
        setInvoices(result);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="max-w-5xl mx-auto w-full px-2 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-2 px-2 sm:px-0">Invoice Calendar</h1>
      <p className="text-gray-400 mb-6 px-2 sm:px-0">Your invoices laid out by deadline.</p>
      {loading && <div className="animate-pulse h-96 bg-gray-800 rounded-xl" />}
      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && <InvoiceCalendar invoices={invoices} />}
    </main>
  );
}
