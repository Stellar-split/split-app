"use client";

import { useEffect, useState } from "react";

/** Shared animated shimmer base */
const shimmer = "animate-pulse bg-gray-200 dark:bg-gray-700 rounded";

/** Base pulsing rectangle primitive — every skeleton in the app builds on this. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`${shimmer} ${className}`} />;
}

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

/**
 * Matches InvoiceCard's shape: title/status row, due-date line, recipient
 * chips, progress bar, funded/total row, and the deadline footer row —
 * same dimensions as the real card so the swap from skeleton to data
 * causes no layout shift.
 */
export function SkeletonCard() {
  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 sm:p-5">
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
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/** Matches a table/list row */
export function SkeletonRow() {
  return (
    <div className="flex justify-between bg-gray-100 dark:bg-gray-900 rounded-lg px-4 py-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/** Matches PaymentProgress bar */
export function SkeletonProgress() {
  return <Skeleton className="h-2 w-full" />;
}

/**
 * InvoiceCardSkeleton — matches InvoiceCard layout.
 * aria-busy indicates loading state.
 */
export function InvoiceCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading invoice data"
      className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 sm:p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20 mb-3" />
      <div className="flex gap-1 mb-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-28" />
      </div>
      <Skeleton className="h-2 w-full mb-1" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
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
      role="status"
      aria-busy="true"
      aria-label="Loading invoice data"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-full" />
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Payment history */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        {[0, 1].map((i) => (
          <div key={i} className="flex justify-between bg-gray-100 dark:bg-gray-900 rounded-lg px-4 py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-20" />
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
      role="status"
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
      role="status"
      aria-busy="true"
      aria-label="Loading..."
      className="bg-gray-100 dark:bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
    >
      <div className="flex flex-col gap-1.5 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/**
 * SkeletonLeaderboardRow — matches a leaderboard table row.
 */
export function SkeletonLeaderboardRow() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading..."
      className="flex items-center gap-4 px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg"
    >
      <Skeleton className="h-5 w-6" />
      <Skeleton className="h-4 w-48" />
      <div className="flex-1" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

/**
 * SkeletonCreatorProfile — matches creator profile header layout.
 */
export function SkeletonCreatorProfile() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading..."
      className="space-y-4"
    >
      {/* Avatar + name row */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 space-y-1.5">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-20" />
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
      role="status"
      aria-busy="true"
      aria-label="Loading..."
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-gray-100 dark:bg-gray-900 p-4 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Matches a subscription summary card. */
export function SubscriptionCardSkeleton() {
  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-24 mb-3" />
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function SubscriptionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading subscriptions"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SubscriptionCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SubscriptionDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading subscription details"
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 space-y-3">
        <Skeleton className="h-4 w-36" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
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
