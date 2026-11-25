"use client";

/**
 * Skip navigation link for keyboard and screen reader users.
 * Visually hidden until focused, then jumps straight to the
 * main content landmark, bypassing the navbar/banners.
 */
export default function SkipNavLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
    >
      Skip to main content
    </a>
  );
}
