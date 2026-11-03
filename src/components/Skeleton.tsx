export function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className || ''}`} />;
}

export function SkeletonCard() {
  return <div className="skeleton-card"><Skeleton className="h-8 w-full mb-2" /><Skeleton className="h-4 w-3/4" /></div>;
}

export function SubscriptionDetailSkeleton() {
  return <div className="skeleton-detail"><Skeleton className="h-10 w-full mb-3" /><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-6 w-1/2" /></div>;
}

export function SubscriptionListSkeleton() {
  return <div className="skeleton-list"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
}

export function InvoiceDetailSkeleton() {
  return <div className="skeleton-detail"><Skeleton className="h-12 w-full mb-4" /><Skeleton className="h-6 w-full mb-2" /><Skeleton className="h-6 w-3/4" /></div>;
}

export function InvoiceListSkeleton() {
  return <div className="skeleton-list"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
}

export function SkeletonPaymentRow() {
  return <div className="skeleton-row"><Skeleton className="h-8 w-full" /></div>;
}

export function SkeletonProgress() {
  return <div className="skeleton-progress"><Skeleton className="h-4 w-full" /></div>;
}

export function SkeletonRow() {
  return <div className="skeleton-row"><Skeleton className="h-6 w-full mb-2" /></div>;
}
