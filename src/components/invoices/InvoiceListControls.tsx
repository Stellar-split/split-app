"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useWalletContext } from "@/contexts/WalletContext";
import {
  SORT_OPTIONS,
  INVOICE_STATUS_FILTERS,
  type DashboardSortId,
  type InvoiceStatusFilter,
} from "@/lib/dashboardFilters";

/**
 * InvoiceListControls — search, status filter chips and sort, extracted as a
 * Client Component so the invoice list page itself can stay a Server
 * Component. Every change is pushed to the URL via router.replace; the
 * server re-reads the updated searchParams and streams a fresh
 * <InvoiceTable> into the existing Suspense boundary, so this component's
 * own state (the search input's focus, etc.) survives the round trip.
 */
export default function InvoiceListControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useWalletContext();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debouncedSearch = useDebounce(search, 300);

  const activeStatuses = (searchParams.get("status") ?? "")
    .split(",")
    .filter(Boolean) as InvoiceStatusFilter[];
  const sort = (searchParams.get("sort") ?? "newest") as DashboardSortId;

  const pushParams = (updates: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    // Keep the connected wallet address in the URL so the server component
    // can fetch without a client-only session.
    if (address) sp.set("address", address);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  // Sync the connected wallet address into the URL once known, so the
  // server fetch has something to key off before any filter is touched.
  useEffect(() => {
    if (address && searchParams.get("address") !== address) {
      pushParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (debouncedSearch !== (searchParams.get("q") ?? "")) {
      pushParams({ q: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const toggleStatus = (status: InvoiceStatusFilter) => {
    const next = activeStatuses.includes(status)
      ? activeStatuses.filter((s) => s !== status)
      : [...activeStatuses, status];
    pushParams({ status: next.join(",") });
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoices by title or memo…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {INVOICE_STATUS_FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => toggleStatus(status)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              activeStatuses.includes(status)
                ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                : "border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {status}
          </button>
        ))}

        <select
          value={sort}
          onChange={(e) => pushParams({ sort: e.target.value })}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-gray-900 border border-gray-800 text-gray-300 outline-none"
          aria-label="Sort invoices"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
