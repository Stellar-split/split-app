import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOfflineDraftAutosave } from "./useOfflineDraftAutosave";
import {
  getDraft,
  putDraft,
  __resetOfflineDraftDBForTests,
  type DraftFormData,
} from "@/lib/offlineDraftDB";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true, writable: true });
}

const data: DraftFormData = {
  recipients: [{ address: "GRECIPIENT", amount: "10" }],
  token: "USDC",
  deadlineDays: 7,
  recurring: false,
  intervalDays: 7,
};

describe("useOfflineDraftAutosave", () => {
  beforeEach(async () => {
    await __resetOfflineDraftDBForTests();
    setOnline(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ received: true }) })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it(
    "autosaves the draft to IndexedDB within 5 seconds while offline",
    async () => {
      renderHook(() => useOfflineDraftAutosave("user-1", "draft-a", data));

      await waitFor(
        async () => {
          const stored = await getDraft("user-1", "draft-a");
          expect(stored?.data).toEqual(data);
        },
        { timeout: 6_000, interval: 200 }
      );

      expect(fetch).not.toHaveBeenCalled();
    },
    8_000
  );

  it("flushes to the server and clears the local entry on reconnection", async () => {
    await putDraft("user-1", "draft-a", data);
    renderHook(() => useOfflineDraftAutosave("user-1", "draft-a", data));

    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(async () => {
      expect(await getDraft("user-1", "draft-a")).toBeUndefined();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/invoices/drafts",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not flush while still offline", async () => {
    await putDraft("user-1", "draft-a", data);
    renderHook(() => useOfflineDraftAutosave("user-1", "draft-a", data));

    await new Promise((r) => setTimeout(r, 50));

    expect(fetch).not.toHaveBeenCalled();
    expect(await getDraft("user-1", "draft-a")).toBeDefined();
  });

  it("reports isOffline reflecting navigator.onLine and browser events", async () => {
    const { result } = renderHook(() => useOfflineDraftAutosave("user-1", "draft-a", data));
    expect(result.current.isOffline).toBe(true);

    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOffline).toBe(false);

    setOnline(false);
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOffline).toBe(true);
  });

  it("discardDraft removes the local entry immediately", async () => {
    await putDraft("user-1", "draft-a", data);
    const { result } = renderHook(() => useOfflineDraftAutosave("user-1", "draft-a", data));

    await act(async () => {
      await result.current.discardDraft();
    });
    expect(await getDraft("user-1", "draft-a")).toBeUndefined();
  });

  it(
    "keeps independent autosave entries per draftId (two tabs, different invoices)",
    async () => {
      renderHook(() => useOfflineDraftAutosave("user-1", "draft-a", data));
      renderHook(() => useOfflineDraftAutosave("user-1", "draft-b", { ...data, token: "XLM" }));

      await waitFor(
        async () => {
          expect((await getDraft("user-1", "draft-a"))?.data.token).toBe("USDC");
          expect((await getDraft("user-1", "draft-b"))?.data.token).toBe("XLM");
        },
        { timeout: 6_000, interval: 200 }
      );
    },
    8_000
  );
});
