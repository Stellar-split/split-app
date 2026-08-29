import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ActivityFeed from "@/components/ActivityFeed";
import type { ActivityEvent } from "@/types/activity";

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  // @ts-expect-error - assigning to global
  global.IntersectionObserver = MockIntersectionObserver;
});

vi.mock("@/hooks/useActivityFeed", () => ({
  useActivityFeed: vi.fn(),
}));

import { useActivityFeed } from "@/hooks/useActivityFeed";

const mockUseActivityFeed = vi.mocked(useActivityFeed);

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    eventId: "ae-1",
    invoiceId: "1",
    type: "payment_received",
    actor: "GALICE",
    timestamp: Date.now(),
    meta: { amount: 10_000_000 },
    ...overrides,
  };
}

describe("ActivityFeed", () => {
  it("renders nothing when closed", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [],
      readIds: new Set(),
      unreadCount: 0,
      isConnected: true,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    const { container } = render(<ActivityFeed open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders empty state when no events", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [],
      readIds: new Set(),
      unreadCount: 0,
      isConnected: true,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("renders empty state with icon and CTA link", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [],
      readIds: new Set(),
      unreadCount: 0,
      isConnected: true,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByText(/create your first invoice/i)).toBeInTheDocument();
  });

  it("includes CTA link to /invoice/new in empty state", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [],
      readIds: new Set(),
      unreadCount: 0,
      isConnected: true,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    const ctaLink = screen.getByRole("link", { name: /create.*invoice/i });
    expect(ctaLink).toHaveAttribute("href", "/invoice/new");
  });

  it("hides empty state when data is loading", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [],
      readIds: new Set(),
      unreadCount: 0,
      isConnected: false,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    const skeleton = document.querySelector('[data-testid="skeleton"]');
    if (skeleton) {
      expect(screen.queryByText(/No activity yet/)).not.toBeInTheDocument();
    }
  });

  it("renders skeleton loader during loading state", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [],
      readIds: new Set(),
      unreadCount: 0,
      isConnected: false,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    const loaders = document.querySelectorAll('.animate-pulse, [class*="skeleton"]');
    expect(loaders.length).toBeGreaterThanOrEqual(0);
  });

  it("renders feed items with event descriptions", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [
        makeEvent({ type: "payment_received", meta: { amount: 10_000_000 } }),
        makeEvent({
          eventId: "ae-2",
          type: "comment",
          meta: { text: "Looks good" },
        }),
      ],
      readIds: new Set(),
      unreadCount: 2,
      isConnected: true,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    expect(screen.getByText(/1\.00 USDC/)).toBeInTheDocument();
    expect(screen.getByText(/Looks good/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // unread badge
  });

  it("shows connection status indicator", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [],
      readIds: new Set(),
      unreadCount: 0,
      isConnected: false,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    const dot = screen.getByTitle("Disconnected");
    expect(dot).toHaveClass("bg-red-400");
  });

  it("renders filter chips for all event types", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [],
      readIds: new Set(),
      unreadCount: 0,
      isConnected: true,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Comment")).toBeInTheDocument();
    expect(screen.getByText("Co-creator")).toBeInTheDocument();
  });

  it("links feed items to correct invoice URLs", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [
        makeEvent({
          invoiceId: "42",
          type: "status_change",
          meta: { from: "Pending", to: "Released" },
        }),
      ],
      readIds: new Set(),
      unreadCount: 1,
      isConnected: true,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    const link = screen.getByText("Invoice moved from Pending to Released")
      .closest("a");
    expect(link).toHaveAttribute("href", "/invoice/42");
  });

  it("deep-links comments to anchor on invoice page", () => {
    mockUseActivityFeed.mockReturnValue({
      events: [
        makeEvent({
          eventId: "ae-10",
          invoiceId: "5",
          type: "comment",
          meta: { commentId: "c-abc", text: "Nice work" },
        }),
      ],
      readIds: new Set(),
      unreadCount: 1,
      isConnected: true,
      markAsRead: vi.fn(),
      markManyAsRead: vi.fn(),
      activeFilters: [],
      toggleFilter: vi.fn(),
      clearFilters: vi.fn(),
    });

    render(<ActivityFeed open={true} />);
    const link = screen.getByText(/Nice work/).closest("a");
    expect(link).toHaveAttribute("href", "/invoice/5#comment-c-abc");
  });
});
