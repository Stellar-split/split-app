import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  publishActivity,
  getRecentEvents,
  subscribe,
  resetActivityStoreForTests,
} from "@/lib/activityFeedStore";

describe("activityFeedStore", () => {
  beforeEach(() => {
    resetActivityStoreForTests();
  });

  it("publishes an event and returns it", () => {
    const event = publishActivity("1", "payment_received", "GALICE", {
      amount: 10_000_000,
    });

    expect(event.eventId).toMatch(/^ae-/);
    expect(event.invoiceId).toBe("1");
    expect(event.type).toBe("payment_received");
    expect(event.actor).toBe("GALICE");
    expect(event.meta.amount).toBe(10_000_000);
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it("stores events retrievable via getRecentEvents", () => {
    publishActivity("1", "payment_received", "GALICE");
    publishActivity("2", "status_change", "GBOB", {
      from: "Pending",
      to: "Released",
    });

    const events = getRecentEvents(10);
    expect(events).toHaveLength(2);
    expect(events[0].invoiceId).toBe("1");
    expect(events[1].invoiceId).toBe("2");
  });

  it("limits stored events to MAX_EVENTS", () => {
    for (let i = 0; i < 250; i++) {
      publishActivity(String(i), "comment", "GALICE", { text: `msg-${i}` });
    }

    const events = getRecentEvents(300);
    expect(events.length).toBeLessThanOrEqual(200);
    expect(events[events.length - 1].meta.text).toBe("msg-249");
  });

  it("subscribes to live events and unsubscribes cleanly", () => {
    const received: unknown[] = [];
    const unsubscribe = subscribe((event) => received.push(event));

    publishActivity("1", "payment_received", "GALICE");
    publishActivity("2", "comment", "GBOB", { text: "hi" });
    unsubscribe();
    publishActivity("3", "co_creator_action", "GCAROL");

    expect(received).toHaveLength(2);
  });

  it("publishes all event types", () => {
    const types = [
      "payment_received",
      "status_change",
      "comment",
      "co_creator_action",
    ] as const;

    for (const type of types) {
      const event = publishActivity("1", type, "GALICE");
      expect(event.type).toBe(type);
    }

    expect(getRecentEvents()).toHaveLength(4);
  });
});
