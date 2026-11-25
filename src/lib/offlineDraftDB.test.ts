import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  putDraft,
  getDraft,
  deleteDraft,
  listDraftsForUser,
  draftKey,
  __resetOfflineDraftDBForTests,
  type DraftFormData,
} from "./offlineDraftDB";

function makeData(overrides: Partial<DraftFormData> = {}): DraftFormData {
  return {
    recipients: [{ address: "GRECIPIENT", amount: "10" }],
    token: "USDC",
    deadlineDays: 7,
    recurring: false,
    intervalDays: 7,
    ...overrides,
  };
}

describe("offlineDraftDB", () => {
  beforeEach(async () => {
    await __resetOfflineDraftDBForTests();
  });

  it("builds keys as draft-[userId]-[draftId]", () => {
    expect(draftKey("user-1", "draft-a")).toBe("draft-user-1-draft-a");
  });

  it("writes and reads back a draft", async () => {
    await putDraft("user-1", "draft-a", makeData());
    const draft = await getDraft("user-1", "draft-a");

    expect(draft).toBeDefined();
    expect(draft?.userId).toBe("user-1");
    expect(draft?.draftId).toBe("draft-a");
    expect(draft?.data).toEqual(makeData());
  });

  it("returns undefined for a draft that was never saved", async () => {
    expect(await getDraft("user-1", "nonexistent")).toBeUndefined();
  });

  it("overwrites the same key on repeated saves", async () => {
    await putDraft("user-1", "draft-a", makeData({ token: "USDC" }));
    await putDraft("user-1", "draft-a", makeData({ token: "XLM" }));

    const draft = await getDraft("user-1", "draft-a");
    expect(draft?.data.token).toBe("XLM");
  });

  it("deletes a draft", async () => {
    await putDraft("user-1", "draft-a", makeData());
    await deleteDraft("user-1", "draft-a");
    expect(await getDraft("user-1", "draft-a")).toBeUndefined();
  });

  it("keeps two tabs' drafts (same user, different invoices) independent", async () => {
    await putDraft("user-1", "draft-a", makeData({ token: "USDC" }));
    await putDraft("user-1", "draft-b", makeData({ token: "XLM" }));

    expect((await getDraft("user-1", "draft-a"))?.data.token).toBe("USDC");
    expect((await getDraft("user-1", "draft-b"))?.data.token).toBe("XLM");

    await deleteDraft("user-1", "draft-a");
    expect(await getDraft("user-1", "draft-a")).toBeUndefined();
    expect((await getDraft("user-1", "draft-b"))?.data.token).toBe("XLM");
  });

  it("scopes drafts per user and lists most-recently-updated first", async () => {
    await putDraft("user-1", "draft-a", makeData());
    await new Promise((r) => setTimeout(r, 5));
    await putDraft("user-1", "draft-b", makeData());
    await putDraft("user-2", "draft-c", makeData());

    const userOneDrafts = await listDraftsForUser("user-1");
    expect(userOneDrafts.map((d) => d.draftId)).toEqual(["draft-b", "draft-a"]);

    const userTwoDrafts = await listDraftsForUser("user-2");
    expect(userTwoDrafts.map((d) => d.draftId)).toEqual(["draft-c"]);
  });
});
