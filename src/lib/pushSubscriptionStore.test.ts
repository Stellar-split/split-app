import { describe, it, expect, beforeEach } from "vitest";
import {
  addSubscription,
  removeSubscription,
  removeSubscriptionEverywhere,
  getSubscriptions,
  isSubscribed,
  listTrackedInvoiceIds,
  getNotifiedMilestones,
  markMilestoneNotified,
  __resetPushSubscriptionStoreForTests,
} from "./pushSubscriptionStore";

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "p", auth: "a" } });

describe("pushSubscriptionStore", () => {
  beforeEach(() => {
    __resetPushSubscriptionStoreForTests();
  });

  it("adds and lists subscriptions per invoice", () => {
    addSubscription("inv-1", sub("https://push/1"));
    addSubscription("inv-1", sub("https://push/2"));

    expect(getSubscriptions("inv-1")).toHaveLength(2);
    expect(isSubscribed("inv-1", "https://push/1")).toBe(true);
    expect(isSubscribed("inv-1", "https://push/999")).toBe(false);
  });

  it("dedupes subscriptions by endpoint", () => {
    addSubscription("inv-1", sub("https://push/1"));
    addSubscription("inv-1", sub("https://push/1"));
    expect(getSubscriptions("inv-1")).toHaveLength(1);
  });

  it("removes a subscription from one invoice only", () => {
    addSubscription("inv-1", sub("https://push/1"));
    addSubscription("inv-2", sub("https://push/1"));

    removeSubscription("inv-1", "https://push/1");

    expect(getSubscriptions("inv-1")).toHaveLength(0);
    expect(getSubscriptions("inv-2")).toHaveLength(1);
  });

  it("removes a subscription from every invoice when it goes stale", () => {
    addSubscription("inv-1", sub("https://push/1"));
    addSubscription("inv-2", sub("https://push/1"));

    removeSubscriptionEverywhere("https://push/1");

    expect(getSubscriptions("inv-1")).toHaveLength(0);
    expect(getSubscriptions("inv-2")).toHaveLength(0);
  });

  it("only lists invoices with at least one active subscription", () => {
    addSubscription("inv-1", sub("https://push/1"));
    addSubscription("inv-2", sub("https://push/2"));
    removeSubscription("inv-2", "https://push/2");

    expect(listTrackedInvoiceIds()).toEqual(["inv-1"]);
  });

  it("tracks notified milestones independently per invoice", () => {
    markMilestoneNotified("inv-1", 25);
    markMilestoneNotified("inv-1", 50);
    markMilestoneNotified("inv-2", 25);

    expect([...getNotifiedMilestones("inv-1")]).toEqual([25, 50]);
    expect([...getNotifiedMilestones("inv-2")]).toEqual([25]);
    expect([...getNotifiedMilestones("inv-3")]).toEqual([]);
  });
});
