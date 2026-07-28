import type { Invoice } from "@stellar-split/sdk";

export type SortOption = "newest" | "oldest" | "amount-high" | "deadline";
export type StatusFilter = "All" | "Pending" | "Released" | "Refunded" | "Expired";
export type RoleFilter = "Created" | "Received";

export interface FilterState {
  status: StatusFilter;
  role: RoleFilter;
  startDate: string;
  endDate: string;
  sort: SortOption;
}

export const DEFAULT_FILTERS: FilterState = {
  status: "All",
  role: "Created",
  startDate: "",
  endDate: "",
  sort: "newest",
};

export function filterAndSortInvoices(
  invoices: Invoice[],
  filters: FilterState,
  publicKey: string
): Invoice[] {
  let result = [...invoices];

  // Filter by status
  if (filters.status !== "All") {
    result = result.filter((inv) => inv.status === filters.status);
  }

  // Filter by role
  if (filters.role === "Created") {
    result = result.filter((inv) => inv.creator === publicKey);
  } else if (filters.role === "Received") {
    result = result.filter((inv) =>
      inv.recipients.some((r) => r.address === publicKey)
    );
  }

  // Filter by date range
  if (filters.startDate) {
    const startTs = new Date(filters.startDate).getTime() / 1000;
    result = result.filter((inv) => inv.deadline >= startTs);
  }
  if (filters.endDate) {
    const endTs = new Date(filters.endDate).getTime() / 1000;
    result = result.filter((inv) => inv.deadline <= endTs);
  }

  // Sort
  result = sortInvoices(result, filters.sort);

  return result;
}

function sortInvoices(invoices: Invoice[], sortBy: SortOption): Invoice[] {
  const sorted = [...invoices];

  switch (sortBy) {
    case "newest":
      sorted.sort((a, b) => b.deadline - a.deadline);
      break;
    case "oldest":
      sorted.sort((a, b) => a.deadline - b.deadline);
      break;
    case "amount-high":
      sorted.sort((a, b) => {
        const aTotal = a.recipients.reduce((s, r) => s + r.amount, 0n);
        const bTotal = b.recipients.reduce((s, r) => s + r.amount, 0n);
        return bTotal > aTotal ? 1 : bTotal < aTotal ? -1 : 0;
      });
      break;
    case "deadline":
      sorted.sort((a, b) => a.deadline - b.deadline);
      break;
  }

  return sorted;
}

export function filterStateToUrl(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== "All") params.set("status", filters.status);
  if (filters.role !== "Created") params.set("role", filters.role);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  return params;
}

export function urlToFilterState(searchParams: URLSearchParams): FilterState {
  return {
    status: (searchParams.get("status") as StatusFilter) || "All",
    role: (searchParams.get("role") as RoleFilter) || "Created",
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    sort: (searchParams.get("sort") as SortOption) || "newest",
  };
}
