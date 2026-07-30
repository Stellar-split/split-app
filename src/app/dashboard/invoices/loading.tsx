import { InvoiceListSkeleton } from "@/components/Skeleton";

/**
 * Stream-level skeleton for /dashboard/invoices, shown while the RSC shell
 * (page.tsx) is being server-rendered — before the page's own <Suspense>
 * fallback for the invoice table even mounts.
 */
export default function InvoicesLoading() {
  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
      <div className="h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-3" />
      <div className="h-8 w-2/3 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-4" />
      <InvoiceListSkeleton />
    </main>
  );
}
