import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ResourceLibrary from "@/components/creator/ResourceLibrary";
import {
  DEFAULT_RESOURCES,
  filterResources,
  loadBookmarks,
  saveBookmarks,
  toggleBookmark,
} from "@/lib/creatorResources";

beforeEach(() => window.localStorage.clear());

describe("creatorResources", () => {
  it("filters by query (title, description, tags) and category", () => {
    expect(filterResources(DEFAULT_RESOURCES, { query: "TAX" }).map((r) => r.id)).toEqual(["tax-export"]);
    expect(filterResources(DEFAULT_RESOURCES, { category: "template" }).map((r) => r.id)).toEqual(["invoice-templates"]);
    expect(filterResources(DEFAULT_RESOURCES, { category: "all" })).toHaveLength(DEFAULT_RESOURCES.length);
  });

  it("filters to bookmarks and toggles immutably", () => {
    const none = new Set<string>();
    const one = toggleBookmark(none, "rate-card");
    expect(none.size).toBe(0);
    expect(filterResources(DEFAULT_RESOURCES, { bookmarkedOnly: true }, one).map((r) => r.id)).toEqual(["rate-card"]);
    expect(toggleBookmark(one, "rate-card").size).toBe(0);
  });

  it("round-trips bookmarks and survives corrupt storage", () => {
    saveBookmarks(new Set(["a", "b"]));
    expect([...loadBookmarks()].sort()).toEqual(["a", "b"]);
    window.localStorage.setItem("creator-resource-bookmarks", "{not json");
    expect(loadBookmarks().size).toBe(0);
  });
});

describe("ResourceLibrary", () => {
  it("searches, and bookmarks persist", () => {
    render(<ResourceLibrary />);
    fireEvent.change(screen.getByLabelText("Search resources"), { target: { value: "rate" } });
    expect(screen.getByText("Rate card builder")).toBeInTheDocument();
    expect(screen.queryByText("Tax export")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Bookmark Rate card builder"));
    expect(screen.getByText("Bookmarked")).toBeInTheDocument();
    expect([...loadBookmarks()]).toEqual(["rate-card"]);
  });

  it("shows an empty state", () => {
    render(<ResourceLibrary />);
    fireEvent.change(screen.getByLabelText("Search resources"), { target: { value: "zzz-nothing" } });
    expect(screen.getByText("No resources match.")).toBeInTheDocument();
  });
});
