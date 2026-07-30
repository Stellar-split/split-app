import { Suspense } from "react";
import type { Metadata } from "next";
import InvoiceListControls from "@/components/invoices/InvoiceListControls";
import InvoiceTable from "@/components/invoices/InvoiceTable";
import { InvoiceListSkeleton } from "@/components/Skeleton";
import { fetchInvoicesForAddress } from "@/lib/stellar/horizonServer";
import { sortInvoices, type DashboardSortId } from "@/lib/dashboardFilters";
import { matchesQuery, matchesStatuses, type InvoiceStatusFilter } from "@/lib/invoices/listFilters";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Your Invoices — StellarSplit",
};

interface InvoicesPageProps {
  searchParams: {
    address?: string;
    q?: string;
    status?: string;
    sort?: string;
  };
}

/**
 * Invoice list page — a Server Component that fetches data directly via the
 * Horizon-backed `splitClient`, no client-side fetch waterfall. The shell
 * (heading + controls) renders immediately; the invoice list itself streams
 * in once the on-chain scan resolves, via the Suspense boundary below.
 *
 * The wallet address lives in the URL (?address=…) rather than a server
 * session — Freighter connection state is inherently client-only, so
 * InvoiceListControls syncs the connected address into the URL on mount,
 * which re-triggers this server fetch with the right owner.
 */
export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <h1 className="text-2xl font-bold mb-4">Your Invoices</h1>
      <Suspense fallback={<div className="h-24 mb-4" />}>
        <InvoiceListControls />
      </Suspense>
      <Suspense fallback={<InvoiceListSkeleton />}>
        <InvoiceResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InvoiceResults({ searchParams }: InvoicesPageProps): Promise<JSX.Element> {
  const address = searchParams.address;
  const q = searchParams.q ?? "";
  const sort = (searchParams.sort ?? "newest") as DashboardSortId;
  const statuses = (searchParams.status ?? "").split(",").filter(Boolean) as InvoiceStatusFilter[];

  if (!address) {
    return (
      <p className="text-gray-400 text-sm py-8 text-center">
        Connect your wallet to view your invoices.
      </p>
    );
  }

  const { invoices } = await fetchInvoicesForAddress(address, { limit: 50 });
  const filtered = invoices.filter(
    (invoice) => matchesQuery(invoice, q) && matchesStatuses(invoice, statuses)
  );
  const sorted = sortInvoices(filtered, sort);

  return <InvoiceTable invoices={sorted} emptyMessage="No invoices match your filters." />;
}
