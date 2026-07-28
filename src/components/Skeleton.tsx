/** Base pulsing rectangle primitive — every skeleton in the app builds on this. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-700 rounded ${className}`} />;
}

/**
 * Matches InvoiceCard's shape: title/status row, due-date line, recipient
 * chips, progress bar, funded/total row, and the deadline footer row —
 * same dimensions as the real card so the swap from skeleton to data
 * causes no layout shift.
 */
export function SkeletonCard() {
  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-28 mb-3" />
      <div className="flex gap-1 mb-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>
      <SkeletonProgress />
      <div className="flex justify-between mt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/** Matches a table/list row */
export function SkeletonRow() {
  return (
    <div className="flex justify-between bg-gray-900 rounded-lg px-4 py-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/** Matches PaymentProgress bar */
export function SkeletonProgress() {
  return <Skeleton className="h-2 w-full" />;
}
