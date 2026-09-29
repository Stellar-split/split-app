import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CreatorMarketplace from "@/components/marketplace/CreatorMarketplace";
import { discoverCreators, listCategories, type MarketplaceCreator } from "@/lib/creatorMarketplace";
import { matchMentors, type MentorshipProfile } from "@/lib/mentorshipMatching";

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

const mentors: MentorshipProfile[] = [
  { address: "MA", name: "Mia", skills: ["design", "branding"], interests: ["startups"], yearsExperience: 8, availability: "open" },
  { address: "MB", name: "Max", skills: ["music", "mixing"], interests: ["audio"], yearsExperience: 4, availability: "limited" },
  { address: "MC", name: "Nia", skills: ["design", "ui"], interests: ["startups", "audio"], yearsExperience: 12, availability: "open" },
];

describe("mentorshipMatching", () => {
  it("matches mentors by shared skills and interests", () => {
    const matches = matchMentors(
      { address: "GA", name: "Ada", skills: ["design", "ui"], interests: ["startups"] },
      mentors,
    );
    expect(matches.map((m) => m.mentor.name)).toEqual(["Nia", "Mia", "Max"]);
    expect(matches[0].sharedSkills).toEqual(["design", "ui"]);
    expect(matches[0].sharedInterests).toEqual(["startups"]);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it("filters by availability and respects the limit", () => {
    const matches = matchMentors(
      { address: "GA", name: "Ada", skills: ["design"], interests: [] },
      mentors,
      { availability: "open", limit: 1 },
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].mentor.name).toBe("Nia");
  });

  it("returns no matches when there is no overlap", () => {
    const matches = matchMentors(
      { address: "GA", name: "Ada", skills: ["gardening"], interests: ["cooking"] },
      mentors,
    );
    expect(matches).toEqual([]);
  });
});
