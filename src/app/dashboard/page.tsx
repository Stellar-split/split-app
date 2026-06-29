import { Suspense } from "react";
import DashboardClient from "@/components/DashboardClient";
import { InvoiceListSkeleton } from "@/components/Skeleton";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Your Invoices — StellarSplit",
};

export default async function DashboardPage() {
  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <Suspense fallback={<InvoiceListSkeleton />}>
        <DashboardClient />
      </Suspense>
    </main>
  );
}
