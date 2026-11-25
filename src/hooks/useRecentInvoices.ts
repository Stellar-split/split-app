import { useState, useEffect } from "react";

const STORAGE_KEY = "stellarsplit_recent_invoices";
const MAX_RECENT = 5;

export function useRecentInvoices() {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          setRecentIds(ids.slice(0, MAX_RECENT));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const addRecent = (invoiceId: string) => {
    if (typeof window === "undefined") return;
    try {
      setRecentIds((prev) => {
        // Remove if already exists, then add to front
        const filtered = prev.filter((id) => id !== invoiceId);
        const updated = [invoiceId, ...filtered].slice(0, MAX_RECENT);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Ignore storage errors
    }
  };

  return { recentIds, addRecent };
}
