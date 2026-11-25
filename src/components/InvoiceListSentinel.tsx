"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** Called when the sentinel enters the viewport. */
  onVisible: () => void;
  /** True while the next page is being fetched. */
  loading: boolean;
  /** True when all pages have been loaded. */
  allLoaded: boolean;
  /**
   * Root margin passed to IntersectionObserver.
   * Defaults to "300px" so the fetch triggers 300 px before the user hits the bottom.
   */
  rootMargin?: string;
}

/**
 * InvoiceListSentinel — a zero-height div observed by IntersectionObserver.
 *
 * - Shows a loading spinner while the next page is in flight.
 * - Shows an "all invoices loaded" message when there are no further pages.
 * - Is invisible when more pages may exist and nothing is loading.
 */
export default function InvoiceListSentinel({
  onVisible,
  loading,
  allLoaded,
  rootMargin = "300px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onVisible();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible, rootMargin]);

  return (
    <div ref={ref} className="flex items-center justify-center py-6" aria-live="polite">
      {loading && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <svg
            className="animate-spin h-5 w-5 text-indigo-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Loading more invoices…</span>
        </div>
      )}
      {allLoaded && !loading && (
        <p className="text-sm text-gray-500">All invoices loaded</p>
      )}
    </div>
  );
}
