import Link from "next/link";
import type { Invoice } from "@stellar-split/sdk";
import InvoiceCard from "@/components/InvoiceCard";

interface Props {
  invoices: Invoice[];
  emptyMessage?: string;
}

/**
 * InvoiceTable — server-rendered invoice list. Deliberately has no
 * "use client": it receives already-filtered/sorted data as a prop and only
 * renders markup, so it can stream from the server as part of the RSC
 * invoice list page without shipping any extra client JS.
 */
export default function InvoiceTable({ invoices, emptyMessage = "No invoices found." }: Props) {
  if (invoices.length === 0) {
    return <p className="text-gray-500 text-sm py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {invoices.map((invoice) => (
        <Link key={invoice.id} href={`/invoice/${invoice.id}`} className="block">
          <InvoiceCard invoice={invoice} />
        </Link>
      ))}
    </div>
  );
}
