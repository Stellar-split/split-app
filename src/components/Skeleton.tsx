/** Shared animated shimmer base */
const shimmer = "animate-pulse bg-gray-700 rounded";

/** Matches InvoiceCard dimensions */
export function SkeletonCard() {
  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`${shimmer} h-4 w-24`} />
        <div className={`${shimmer} h-4 w-16`} />
      </div>
      <div className="flex gap-1 mb-3">
        <div className={`${shimmer} h-5 w-28`} />
        <div className={`${shimmer} h-5 w-28`} />
      </div>
      <SkeletonProgress />
      <div className="flex justify-between mt-1">
        <div className={`${shimmer} h-3 w-24`} />
        <div className={`${shimmer} h-3 w-20`} />
      </div>
    </div>
  );
}

/** Matches a table/list row */
export function SkeletonRow() {
  return (
    <div className="flex justify-between bg-gray-900 rounded-lg px-4 py-2">
      <div className={`${shimmer} h-4 w-48`} />
      <div className={`${shimmer} h-4 w-20`} />
    </div>
  );
}

/** Matches PaymentProgress bar */
export function SkeletonProgress() {
  return <div className={`${shimmer} h-2 w-full`} />;
}

/**
 * InvoiceCardSkeleton — matches InvoiceCard layout.
 * aria-busy indicates loading state.
 */
export function InvoiceCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading invoice data"
      className="bg-gray-900 rounded-xl p-4 sm:p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`${shimmer} h-4 w-24`} />
        <div className={`${shimmer} h-5 w-16 rounded-full`} />
      </div>
      <div className={`${shimmer} h-3 w-20 mb-3`} />
      <div className="flex gap-1 mb-3">
        <div className={`${shimmer} h-5 w-28`} />
        <div className={`${shimmer} h-5 w-28`} />
      </div>
      <div className={`${shimmer} h-2 w-full mb-1`} />
      <div className="flex justify-between">
        <div className={`${shimmer} h-3 w-24`} />
        <div className={`${shimmer} h-3 w-20`} />
      </div>
    </div>
  );
}

/**
 * InvoiceDetailSkeleton — matches invoice detail page sections:
 * header, progress bar, recipients, and history.
 */
export function InvoiceDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading invoice data"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={`${shimmer} h-8 w-48`} />
        <div className={`${shimmer} h-7 w-20 rounded-full`} />
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className={`${shimmer} h-3 w-64`} />
        <div className={`${shimmer} h-3 w-full`} />
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <div className={`${shimmer} h-4 w-28`} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-between">
            <div className={`${shimmer} h-4 w-48`} />
            <div className={`${shimmer} h-4 w-24`} />
          </div>
        ))}
      </div>

      {/* Payment history */}
      <div className="space-y-2">
        <div className={`${shimmer} h-4 w-36`} />
        {[0, 1].map((i) => (
          <div key={i} className="flex justify-between bg-gray-900 rounded-lg px-4 py-2">
            <div className={`${shimmer} h-4 w-40`} />
            <div className={`${shimmer} h-4 w-20`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * InvoiceListSkeleton — 6 InvoiceCardSkeleton cards in a grid.
 */
export function InvoiceListSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading invoice data"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {[...Array(6)].map((_, i) => (
        <InvoiceCardSkeleton key={i} />
      ))}
    </div>
  );
}
