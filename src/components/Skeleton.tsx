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
