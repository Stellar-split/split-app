export interface MarketplaceCreator {
  address: string;
  name: string;
  category: string;
  tags: string[];
  rating: number;
  completedInvoices: number;
  verified: boolean;
}

export type CreatorSort = "rating" | "popular" | "name";

export interface CreatorDiscoveryOptions {
  query?: string;
  category?: string;
  verifiedOnly?: boolean;
  sort?: CreatorSort;
}

export function discoverCreators(
  creators: MarketplaceCreator[],
  { query = "", category = "all", verifiedOnly = false, sort = "rating" }: CreatorDiscoveryOptions = {},
): MarketplaceCreator[] {
  const q = query.trim().toLowerCase();
  const result = creators.filter(
    (c) =>
      (category === "all" || c.category === category) &&
      (!verifiedOnly || c.verified) &&
      (!q || c.name.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q))),
  );
  const comparators: Record<CreatorSort, (a: MarketplaceCreator, b: MarketplaceCreator) => number> = {
    rating: (a, b) => b.rating - a.rating || b.completedInvoices - a.completedInvoices,
    popular: (a, b) => b.completedInvoices - a.completedInvoices,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return result.sort(comparators[sort]);
}

export function listCategories(creators: MarketplaceCreator[]): string[] {
  return Array.from(new Set(creators.map((c) => c.category))).sort();
}
