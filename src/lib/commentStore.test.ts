import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addComment,
  listComments,
  getComment,
  deleteComment,
  toggleReaction,
  reactionCounts,
  reactorEmojis,
  isAllowedEmoji,
  subscribe,
  __resetCommentStoreForTests,
} from "./commentStore";

describe("commentStore", () => {
  beforeEach(() => {
    __resetCommentStoreForTests();
  });

  it("adds and lists comments oldest-first", () => {
    const a = addComment("inv-1", "GALICE", "hello");
    const b = addComment("inv-1", "GBOB", "hi back");

    expect(listComments("inv-1")).toEqual([a, b]);
  });

  it("scopes comments per invoice", () => {
    addComment("inv-1", "GALICE", "hello");
    addComment("inv-2", "GBOB", "other invoice");

    expect(listComments("inv-1")).toHaveLength(1);
    expect(listComments("inv-2")).toHaveLength(1);
  });

  it("pages older comments with the before cursor", () => {
    const a = addComment("inv-1", "GALICE", "first");
    vi.useFakeTimers();
    vi.advanceTimersByTime(10);
    const b = addComment("inv-1", "GALICE", "second");
    vi.useRealTimers();

    const page = listComments("inv-1", { before: b.createdAt });
    expect(page).toEqual([a]);
  });

  it("deletes a comment and its reactions", () => {
    const comment = addComment("inv-1", "GALICE", "hello");
    toggleReaction("inv-1", comment.id, "👍", "GBOB");

    expect(deleteComment("inv-1", comment.id)).toBe(true);
    expect(getComment("inv-1", comment.id)).toBeUndefined();
    expect(reactionCounts(comment.id)["👍"]).toBe(0);
  });

  it("returns false deleting a comment that doesn't exist", () => {
    expect(deleteComment("inv-1", "nope")).toBe(false);
  });

  it("validates the allowed emoji set", () => {
    expect(isAllowedEmoji("👍")).toBe(true);
    expect(isAllowedEmoji("🎉")).toBe(false);
  });

  it("toggles a reaction on then off for the same reactor", () => {
    const comment = addComment("inv-1", "GALICE", "hello");

    const first = toggleReaction("inv-1", comment.id, "❤️", "GBOB");
    expect(first.active).toBe(true);
    expect(first.counts["❤️"]).toBe(1);

    const second = toggleReaction("inv-1", comment.id, "❤️", "GBOB");
    expect(second.active).toBe(false);
    expect(second.counts["❤️"]).toBe(0);
  });

  it("tracks reactions independently per reactor", () => {
    const comment = addComment("inv-1", "GALICE", "hello");
    toggleReaction("inv-1", comment.id, "✅", "GBOB");
    toggleReaction("inv-1", comment.id, "✅", "GCAROL");

    expect(reactionCounts(comment.id)["✅"]).toBe(2);
    expect(reactorEmojis(comment.id, "GBOB")).toEqual(["✅"]);
    expect(reactorEmojis(comment.id, "GDAVE")).toEqual([]);
  });

  it("publishes events to subscribers", () => {
    const events: unknown[] = [];
    const unsubscribe = subscribe("inv-1", (event) => events.push(event));

    const comment = addComment("inv-1", "GALICE", "hello");
    const { counts } = toggleReaction("inv-1", comment.id, "👍", "GBOB");
    deleteComment("inv-1", comment.id);
    unsubscribe();
    addComment("inv-1", "GALICE", "after unsubscribe");

    expect(events).toEqual([
      { type: "comment-added", comment },
      { type: "reaction-updated", commentId: comment.id, counts },
      { type: "comment-deleted", commentId: comment.id },
    ]);
  });
});
