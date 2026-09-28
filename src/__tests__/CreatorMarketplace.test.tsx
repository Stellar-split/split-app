import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CreatorMarketplace from "@/components/marketplace/CreatorMarketplace";
import { discoverCreators, listCategories, type MarketplaceCreator } from "@/lib/creatorMarketplace";

const creators: MarketplaceCreator[] = [
  { address: "GA", name: "Ada", category: "Design", tags: ["logo"], rating: 4.2, completedInvoices: 30, verified: true },
  { address: "GB", name: "Bo", category: "Music", tags: ["mixing"], rating: 4.9, completedInvoices: 5, verified: false },
  { address: "GC", name: "Cy", category: "Design", tags: ["ui"], rating: 3.5, completedInvoices: 50, verified: true },
];

describe("creatorMarketplace", () => {
  it("sorts and filters creators", () => {
    expect(discoverCreators(creators).map((c) => c.name)).toEqual(["Bo", "Ada", "Cy"]);
    expect(discoverCreators(creators, { sort: "popular" }).map((c) => c.name)).toEqual(["Cy", "Ada", "Bo"]);
    expect(discoverCreators(creators, { category: "Design", verifiedOnly: true, sort: "name" }).map((c) => c.name)).toEqual(["Ada", "Cy"]);
    expect(discoverCreators(creators, { query: "MIX" }).map((c) => c.name)).toEqual(["Bo"]);
    expect(listCategories(creators)).toEqual(["Design", "Music"]);
  });
});

describe("CreatorMarketplace", () => {
  it("renders creators with profile links and supports filtering", () => {
    render(<CreatorMarketplace creators={creators} />);
    expect(screen.getByRole("link", { name: "Ada" })).toHaveAttribute("href", "/creator/GA");
    fireEvent.click(screen.getByLabelText("Verified only"));
    expect(screen.queryByText("Bo")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search creators"), { target: { value: "zzz" } });
    expect(screen.getByText("No creators found.")).toBeInTheDocument();
  });
});
