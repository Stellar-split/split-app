import type { Metadata } from "next";
import InvoiceEducationalResources from "@/components/InvoiceEducationalResources";

export const metadata: Metadata = {
  title: "Invoice resources — StellarSplit",
};

export default function InvoiceResourcesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Invoice resources</h1>
      <p className="mb-6 text-sm text-gray-500">
        Guides for creating, paying and safely handling invoices on StellarSplit.
      </p>
      <InvoiceEducationalResources />
    </main>
  );
}
