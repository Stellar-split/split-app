import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getSnoozeState,
  snoozeInvoice,
  clearSnooze,
  shouldShowCountdown,
  getTimeRemaining,
  getOverdueDuration,
} from "./expirySnooze";

describe("expirySnooze", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should snooze an invoice", () => {
    const state = snoozeInvoice("inv1", "1h");
    expect(state.invoiceId).toBe("inv1");
    expect(state.option).toBe("1h");
    expect(state.snoozedUntil).toBeGreaterThan(Date.now());
  });

  it("should retrieve snooze state", () => {
    snoozeInvoice("inv1", "4h");
    const state = getSnoozeState("inv1");

    expect(state).toBeDefined();
    expect(state?.invoiceId).toBe("inv1");
    expect(state?.option).toBe("4h");
  });

  it("should return null for non-snoozed invoices", () => {
    const state = getSnoozeState("inv1");
    expect(state).toBeNull();
  });

  it("should clear snooze", () => {
    snoozeInvoice("inv1", "1h");
    clearSnooze("inv1");

    const state = getSnoozeState("inv1");
    expect(state).toBeNull();
  });

  it("should hide countdown when snoozed", () => {
    snoozeInvoice("inv1", "1h");
    const shouldShow = shouldShowCountdown("inv1");

    expect(shouldShow).toBe(false);
  });

  it("should show countdown when not snoozed", () => {
    const shouldShow = shouldShowCountdown("inv1");
    expect(shouldShow).toBe(true);
  });

  it("should calculate time remaining correctly", () => {
    vi.useFakeTimers();
    const now = new Date();
    const dueDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000); // 2d 5h from now

    const time = getTimeRemaining(dueDate);

    expect(time.isOverdue).toBe(false);
    expect(time.days).toBe(2);
    expect(time.hours).toBe(5);
  });

  it("should detect overdue invoices", () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

    const time = getTimeRemaining(pastDate);

    expect(time.isOverdue).toBe(true);
    expect(time.days).toBe(0);
    expect(time.hours).toBe(0);
    expect(time.minutes).toBe(0);
  });

  it("should calculate overdue duration correctly", () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - (1 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000)); // 1d 5h ago

    const overdue = getOverdueDuration(pastDate);

    expect(overdue.days).toBe(1);
    expect(overdue.hours).toBe(5);
  });

  it("should support different snooze durations", () => {
    const inv1h = snoozeInvoice("inv1", "1h");
    const inv4h = snoozeInvoice("inv2", "4h");
    const invTomorrow = snoozeInvoice("inv3", "until-tomorrow");

    const diff4h = inv4h.snoozedUntil - inv1h.snoozedUntil;
    // 4h - 1h = 3h = 3 * 60 * 60 * 1000 = 10,800,000 ms
    const expectedDiff = 3 * 60 * 60 * 1000;
    expect(Math.abs(diff4h - expectedDiff)).toBeLessThan(1000); // Allow 1s tolerance

    // Tomorrow snooze should be larger
    expect(invTomorrow.snoozedUntil).toBeGreaterThan(inv4h.snoozedUntil);
  });
});
