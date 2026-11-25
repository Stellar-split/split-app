/**
 * Feature-detect helpers for the View Transitions API.
 * Kept dependency-free so they can run during render on both client and server
 * (the server branch always returns false, since `document` isn't defined).
 */

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const INVOICE_DETAIL_PATTERN = /^\/invoice\/[^/]+$/;
const INVOICE_STATIC_ROUTES = new Set([
  "/invoice/new",
  "/invoice/batch",
  "/invoice/compare",
  "/invoice/import",
  "/invoice/templates",
]);

function isInvoiceDetailPath(pathname: string): boolean {
  return INVOICE_DETAIL_PATTERN.test(pathname) && !INVOICE_STATIC_ROUTES.has(pathname);
}

/**
 * Best-effort direction guess for the fade-slide transition: "forward" when
 * drilling into an invoice detail page, "back" when returning to the list.
 * Falls back to "forward" for everything else.
 */
export function getTransitionDirection(fromPathname: string, toPathname: string): "forward" | "back" {
  if (isInvoiceDetailPath(fromPathname) && !isInvoiceDetailPath(toPathname)) {
    return "back";
  }
  return "forward";
}
