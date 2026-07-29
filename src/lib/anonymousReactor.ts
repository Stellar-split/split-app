/**
 * Stable per-browser id for unauthenticated payers reacting on the public
 * invoice page, so toggling a reaction twice removes it even without a
 * connected wallet.
 */
const STORAGE_KEY = "stellarsplit_anon_reactor_id";

export function getOrCreateAnonymousReactorId(): string {
  if (typeof window === "undefined") return "anonymous";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `anon-${crypto.randomUUID()}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
