import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CreatorMarketplace from "@/components/marketplace/CreatorMarketplace";
import { discoverCreators, listCategories, type MarketplaceCreator } from "@/lib/creatorMarketplace";
import { matchCreatorToMentors, type AppCreator, type Mentor } from "@/lib/mentorship";

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

const creator: AppCreator = {
  id: "GA",
  name: "Ada",
  skills: ["design", "ui"],
  interests: ["startups"],
  experienceLevel: "intermediate",
};

const mentors: Mentor[] = [
  { id: "MA", name: "Mia", expertise: ["design", "branding"], interests: ["startups"], experienceLevel: "advanced", maxMentees: 5 },
  { id: "MB", name: "Max", expertise: ["music", "mixing"], interests: ["audio"], experienceLevel: "intermediate", maxMentees: 3 },
  { id: "MC", name: "Nia", expertise: ["design", "ui"], interests: ["startups", "audio"], experienceLevel: "advanced", maxMentees: 4 },
];

describe("mentorshipMatching", () => {
  it("matches mentors by shared skills and interests", () => {
    const matches = matchCreatorToMentors(creator, mentors);
    expect(matches.map((m) => mentors.find((mentor) => mentor.id === m.mentorId)?.name)).toEqual(["Nia", "Mia"]);
    expect(matches[0].sharedSkills).toEqual(["design", "ui"]);
    expect(matches[0].sharedInterests).toEqual(["startups"]);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it("respects the limit parameter", () => {
    const matches = matchCreatorToMentors(creator, mentors, 1);
    expect(matches).toHaveLength(1);
    expect(mentors.find((m) => m.id === matches[0].mentorId)?.name).toBe("Nia");
  });

  it("returns no matches when there is no overlap", () => {
    const noSkillCreator: AppCreator = {
      id: "GX",
      name: "Xavier",
      skills: ["gardening"],
      interests: ["cooking"],
      experienceLevel: "beginner",
    };
    const matches = matchCreatorToMentors(noSkillCreator, mentors);
    expect(matches).toEqual([]);
  });
});
