import { Suspense } from "react";
import DashboardClient from "@/components/DashboardClient";
import { SkeletonCard } from "@/components/Skeleton";

/**
 * Dashboard page with streaming SSR.
 * The page shell renders immediately, and invoice cards stream in as they load.
 * Wrapped in Suspense because DashboardClient reads/writes the `status`
 * filter via useSearchParams(), which Next.js requires a boundary for.
 */
export default async function DashboardPage() {
  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            {[...Array(8)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        <DashboardClient />
      </Suspense>
    </main>
  );
}
