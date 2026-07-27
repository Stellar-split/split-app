import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  simulateOpen() {
    this.onopen?.(new Event("open"));
  }

  simulateError() {
    this.onerror?.(new Event("error"));
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// @ts-expect-error - assigning to global
global.EventSource = MockEventSource;

import { useActivityFeed } from "../useActivityFeed";

describe("useActivityFeed", () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an EventSource on mount and connects to /api/activity-feed", () => {
    renderHook(() => useActivityFeed());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/activity-feed");
  });

  it("parses snapshot events from the stream", () => {
    const { result } = renderHook(() => useActivityFeed());

    const snapshot = {
      type: "snapshot",
      events: [
        {
          eventId: "ae-1",
          invoiceId: "1",
          type: "payment_received",
          actor: "GALICE",
          timestamp: Date.now(),
          meta: { amount: 10_000_000 },
        },
      ],
    };

    act(() => {
      MockEventSource.instances[0].simulateOpen();
      MockEventSource.instances[0].simulateMessage(JSON.stringify(snapshot));
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].invoiceId).toBe("1");
    expect(result.current.isConnected).toBe(true);
  });

  it("appends live events and deduplicates", () => {
    const { result } = renderHook(() => useActivityFeed());

    const snapshot = {
      type: "snapshot",
      events: [
        {
          eventId: "ae-1",
          invoiceId: "1",
          type: "payment_received",
          actor: "GALICE",
          timestamp: Date.now(),
          meta: {},
        },
      ],
    };

    const liveEvent = {
      type: "event",
      event: {
        eventId: "ae-2",
        invoiceId: "2",
        type: "comment",
        actor: "GBOB",
        timestamp: Date.now(),
        meta: { text: "hello" },
      },
    };

    // Duplicate event with same ID
    const duplicate = {
      type: "event",
      event: {
        eventId: "ae-1",
        invoiceId: "1",
        type: "payment_received",
        actor: "GALICE",
        timestamp: Date.now(),
        meta: {},
      },
    };

    act(() => {
      MockEventSource.instances[0].simulateMessage(JSON.stringify(snapshot));
      MockEventSource.instances[0].simulateMessage(JSON.stringify(liveEvent));
      MockEventSource.instances[0].simulateMessage(JSON.stringify(duplicate));
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[1].eventId).toBe("ae-2");
  });

  it("filters events by type when filters are active", () => {
    const { result } = renderHook(() => useActivityFeed());

    const snapshot = {
      type: "snapshot",
      events: [
        {
          eventId: "ae-1",
          invoiceId: "1",
          type: "payment_received",
          actor: "GALICE",
          timestamp: Date.now(),
          meta: {},
        },
        {
          eventId: "ae-2",
          invoiceId: "1",
          type: "comment",
          actor: "GBOB",
          timestamp: Date.now(),
          meta: {},
        },
        {
          eventId: "ae-3",
          invoiceId: "1",
          type: "status_change",
          actor: "GCAROL",
          timestamp: Date.now(),
          meta: {},
        },
      ],
    };

    act(() => {
      MockEventSource.instances[0].simulateMessage(JSON.stringify(snapshot));
    });

    expect(result.current.events).toHaveLength(3);

    act(() => {
      result.current.toggleFilter("payment_received");
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe("payment_received");

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.events).toHaveLength(3);
  });

  it("tracks unread count based on read state", () => {
    const { result } = renderHook(() => useActivityFeed());

    const snapshot = {
      type: "snapshot",
      events: [
        {
          eventId: "ae-1",
          invoiceId: "1",
          type: "payment_received",
          actor: "GALICE",
          timestamp: Date.now(),
          meta: {},
        },
        {
          eventId: "ae-2",
          invoiceId: "1",
          type: "comment",
          actor: "GBOB",
          timestamp: Date.now(),
          meta: {},
        },
      ],
    };

    act(() => {
      MockEventSource.instances[0].simulateMessage(JSON.stringify(snapshot));
    });

    expect(result.current.unreadCount).toBe(2);

    act(() => {
      result.current.markAsRead("ae-1");
    });

    expect(result.current.unreadCount).toBe(1);
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => useActivityFeed());

    const es = MockEventSource.instances[0];
    unmount();

    expect(es.close).toHaveBeenCalled();
  });

  it("reconnects on error with exponential backoff", () => {
    renderHook(() => useActivityFeed());

    act(() => {
      MockEventSource.instances[0].simulateError();
    });

    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });
});
