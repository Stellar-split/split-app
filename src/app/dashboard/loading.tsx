import { SkeletonCard } from "@/components/Skeleton";

/**
 * Route-level loading UI for dashboard.
 * Shown while the page is being server-rendered.
 */
export default function DashboardLoading() {
  return (
    <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="flex items-center justify-between mb-10 flex-wrap gap-3">
        <div className="h-9 w-40 bg-gray-700 rounded animate-pulse" />
        <div className="h-11 w-32 bg-gray-700 rounded-lg animate-pulse" />
      </div>

      <div className="mb-6">
        <div className="h-12 w-full bg-gray-800 rounded-lg animate-pulse" />
      </div>

      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}
