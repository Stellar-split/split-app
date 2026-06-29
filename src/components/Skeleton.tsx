"use client";

import { useEffect, useState } from "react";

/** Shared animated shimmer base */
const shimmer = "animate-pulse bg-gray-200 dark:bg-gray-700 rounded";

/**
 * useDeferredShow — returns false until `delayMs` has elapsed.
 * Prevents skeleton flash when data loads in under the threshold.
 */
function useDeferredShow(delayMs = 200): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  return show;
}

/** Matches InvoiceCard dimensions */
export function SkeletonCard() {
  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-5">
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
    <div className="flex justify-between bg-gray-100 dark:bg-gray-900 rounded-lg px-4 py-2">
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
 * InvoiceListSkeleton — N InvoiceCardSkeleton cards in a grid.
 * Accepts a `count` prop (default 6).
 */
export function InvoiceListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading invoice data"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <InvoiceCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * SkeletonPaymentRow — matches a payment history table row / mobile card.
 * Used on the /payments page during loading.
 */
export function SkeletonPaymentRow() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading..."
      className="bg-gray-100 dark:bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
    >
      <div className="flex flex-col gap-1.5 flex-1">
        <div className={`${shimmer} h-4 w-32`} />
        <div className={`${shimmer} h-3 w-20`} />
      </div>
      <div className={`${shimmer} h-4 w-24`} />
      <div className={`${shimmer} h-4 w-24`} />
      <div className={`${shimmer} h-4 w-16`} />
    </div>
  );
}

/**
 * SkeletonLeaderboardRow — matches a leaderboard table row.
 */
export function SkeletonLeaderboardRow() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading..."
      className="flex items-center gap-4 px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg"
    >
      <div className={`${shimmer} h-5 w-6`} />
      <div className={`${shimmer} h-4 w-48`} />
      <div className="flex-1" />
      <div className={`${shimmer} h-4 w-20`} />
    </div>
  );
}

/**
 * SkeletonCreatorProfile — matches creator profile header layout.
 */
export function SkeletonCreatorProfile() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading..."
      className="space-y-4"
    >
      {/* Avatar + name row */}
      <div className="flex items-center gap-4">
        <div className={`${shimmer} h-14 w-14 rounded-full`} />
        <div className="space-y-2">
          <div className={`${shimmer} h-5 w-40`} />
          <div className={`${shimmer} h-3 w-28`} />
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 space-y-1.5">
            <div className={`${shimmer} h-6 w-16`} />
            <div className={`${shimmer} h-3 w-20`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonDashboardStats — matches the dashboard header stat cards.
 */
export function SkeletonDashboardStats() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading..."
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 space-y-3">
          <div className={`${shimmer} h-3 w-24`} />
          <div className={`${shimmer} h-8 w-32`} />
          <div className={`${shimmer} h-2 w-full`} />
        </div>
      ))}
    </div>
  );
}

/**
 * DeferredSkeleton — wraps any skeleton and only renders it after `delayMs`
 * (default 200ms) to avoid a flash of loading UI on fast connections.
 */
export function DeferredSkeleton({
  children,
  delayMs = 200,
}: {
  children: React.ReactNode;
  delayMs?: number;
}) {
  const show = useDeferredShow(delayMs);
  if (!show) return null;
  return <>{children}</>;
}
