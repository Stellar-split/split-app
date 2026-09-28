import { describe, it, expect } from "vitest";
import { newTopicUrl, sortTopicsByActivity, topicUrl } from "./creatorForum";

const config = { baseUrl: "https://forum.example.com/" };

describe("creatorForum", () => {
  it("builds topic URLs without double slashes", () => {
    expect(topicUrl(config, { id: 42, slug: "tips" })).toBe("https://forum.example.com/t/tips/42");
  });

  it("builds an encoded new-topic URL", () => {
    expect(newTopicUrl(config, "Help & tips")).toBe("https://forum.example.com/new-topic?title=Help+%26+tips&category=creators");
  });

  it("sorts topics by most recent activity", () => {
    const topics = [
      { id: 1, title: "a", slug: "a", replies: 0, lastActivity: "2025-01-01T00:00:00Z" },
      { id: 2, title: "b", slug: "b", replies: 3, lastActivity: "2025-06-01T00:00:00Z" },
    ];
    expect(sortTopicsByActivity(topics).map((t) => t.id)).toEqual([2, 1]);
  });
});
