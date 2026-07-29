import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DisputeTimeline from "../DisputeTimeline";

// Mock the stellar client
const mockGetDisputeEvents = vi.fn();

vi.mock("@/lib/stellar", () => ({
  splitClient: {
    getDisputeEvents: mockGetDisputeEvents,
  },
}));

const mockDisputeStatus = {
  releaseVotes: 2,
  refundVotes: 1,
  resolved: false,
  reason: "Non-delivery",
  initiator: "GPAYER123",
};

const mockEvents = [
  {
    type: "DisputeOpened" as const,
    timestamp: 1700000000,
    actor: "GPAYER123",
    metadata: {
      reason: "Non-delivery",
    },
  },
  {
    type: "EvidenceSubmitted" as const,
    timestamp: 1700010000,
    actor: "GPAYER123",
    metadata: {
      evidenceCid: "QmExampleCID123",
      filename: "contract.pdf",
    },
  },
  {
    type: "VoteCast" as const,
    timestamp: 1700020000,
    actor: "GARBITRATOR1",
    metadata: {
      vote: "Release" as const,
    },
  },
  {
    type: "VoteCast" as const,
    timestamp: 1700030000,
    actor: "GARBITRATOR2",
    metadata: {
      vote: "Release" as const,
    },
  },
  {
    type: "VoteCast" as const,
    timestamp: 1700040000,
    actor: "GARBITRATOR3",
    metadata: {
      vote: "Refund" as const,
    },
  },
];

describe("DisputeTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Timeline Chronology", () => {
    it("displays events in chronological order", async () => {
      mockGetDisputeEvents.mockResolvedValue(mockEvents);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Dispute Opened")).toBeInTheDocument();
      });

      const eventTitles = screen.getAllByRole("heading", { level: 3 });
      expect(eventTitles[0]).toHaveTextContent("Dispute Opened");
      expect(eventTitles[1]).toHaveTextContent("Evidence Submitted");
      expect(eventTitles[2]).toHaveTextContent("Vote Cast");
    });

    it("sorts events by timestamp when loaded out of order", async () => {
      const unsortedEvents = [
        mockEvents[4], // Latest vote
        mockEvents[0], // Dispute opened
        mockEvents[2], // First vote
        mockEvents[1], // Evidence
        mockEvents[3], // Second vote
      ];

      mockGetDisputeEvents.mockResolvedValue(unsortedEvents);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Dispute Opened")).toBeInTheDocument();
      });

      // Events should be rendered in sorted order
      const listItems = screen.getAllByRole("listitem");
      
      // First event should be DisputeOpened (earliest timestamp)
      expect(listItems[0]).toHaveTextContent("Dispute Opened");
      
      // Last event should be the latest vote (highest timestamp)
      expect(listItems[listItems.length - 1]).toHaveTextContent("Vote Cast");
    });
  });

  describe("Event Type Rendering", () => {
    it("renders DisputeOpened event with reason", async () => {
      mockGetDisputeEvents.mockResolvedValue([mockEvents[0]]);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Dispute Opened")).toBeInTheDocument();
        expect(screen.getByText("Non-delivery")).toBeInTheDocument();
      });
    });

    it("renders EvidenceSubmitted event with IPFS link", async () => {
      mockGetDisputeEvents.mockResolvedValue([mockEvents[1]]);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Evidence Submitted")).toBeInTheDocument();
        expect(screen.getByText("contract.pdf")).toBeInTheDocument();
      });

      const viewLink = screen.getByRole("link", { name: /View/i });
      expect(viewLink).toHaveAttribute("href", "https://ipfs.io/ipfs/QmExampleCID123");
    });

    it("renders VoteCast event with vote type", async () => {
      mockGetDisputeEvents.mockResolvedValue([mockEvents[2]]);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Vote Cast")).toBeInTheDocument();
        expect(screen.getByText(/✓ Approve/i)).toBeInTheDocument();
      });
    });

    it("renders DisputeResolved event with final tally", async () => {
      const resolvedEvents = [
        ...mockEvents,
        {
          type: "DisputeResolved" as const,
          timestamp: 1700050000,
          actor: "GCONTRACT",
          metadata: {
            outcome: "Release" as const,
          },
        },
      ];

      const resolvedStatus = {
        ...mockDisputeStatus,
        resolved: true,
        outcome: "Release" as const,
      };

      mockGetDisputeEvents.mockResolvedValue(resolvedEvents);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={resolvedStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Dispute Resolved")).toBeInTheDocument();
        expect(screen.getByText(/✓ Released/i)).toBeInTheDocument();
        expect(screen.getByText(/2 release/i)).toBeInTheDocument();
        expect(screen.getByText(/1 refund/i)).toBeInTheDocument();
      });
    });
  });

  describe("Actor Display", () => {
    it("displays truncated actor addresses", async () => {
      mockGetDisputeEvents.mockResolvedValue([mockEvents[0]]);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        // Should show truncated version of GPAYER123
        expect(screen.getByText(/GPAYER/i)).toBeInTheDocument();
      });
    });

    it("shows actor for each event", async () => {
      mockGetDisputeEvents.mockResolvedValue(mockEvents.slice(0, 3));

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        const byTexts = screen.getAllByText(/^By /);
        expect(byTexts.length).toBe(3);
      });
    });
  });

  describe("Timestamp Formatting", () => {
    it("formats timestamps correctly", async () => {
      mockGetDisputeEvents.mockResolvedValue([mockEvents[0]]);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        // Should format as "Nov 14, 10:13 PM" or similar
        const timestamp = screen.getByText(/Nov \d+, \d+:\d+ [AP]M/i);
        expect(timestamp).toBeInTheDocument();
      });
    });
  });

  describe("Loading State", () => {
    it("shows loading skeleton while fetching events", () => {
      mockGetDisputeEvents.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 1000))
      );

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      // Should show loading state
      expect(screen.getByText("Dispute Timeline")).toBeInTheDocument();
      const skeleton = document.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty message when no events exist", async () => {
      mockGetDisputeEvents.mockResolvedValue([]);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/No dispute events recorded yet/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      mockGetDisputeEvents.mockRejectedValue(new Error("API Error"));
      
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        // Should show empty state on error
        expect(screen.getByText(/No dispute events recorded yet/i)).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load dispute events:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Visual Indicators", () => {
    it("uses correct icon for each event type", async () => {
      mockGetDisputeEvents.mockResolvedValue(mockEvents.slice(0, 3));

      const { container } = render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Dispute Opened")).toBeInTheDocument();
      });

      // Check for emoji icons in timeline markers
      expect(container.textContent).toContain("⚠️"); // DisputeOpened
      expect(container.textContent).toContain("📎"); // EvidenceSubmitted
      expect(container.textContent).toContain("⚖️"); // VoteCast
    });

    it("applies correct color coding to event markers", async () => {
      mockGetDisputeEvents.mockResolvedValue(mockEvents.slice(0, 3));

      const { container } = render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Dispute Opened")).toBeInTheDocument();
      });

      // Check for color classes (implementation depends on getEventColor)
      const markers = container.querySelectorAll("[class*='border-']");
      expect(markers.length).toBeGreaterThan(0);
    });
  });

  describe("Multiple Votes", () => {
    it("displays multiple vote events correctly", async () => {
      const voteEvents = mockEvents.slice(2); // All vote events

      mockGetDisputeEvents.mockResolvedValue(voteEvents);

      render(
        <DisputeTimeline
          invoiceId="invoice-123"
          disputeStatus={mockDisputeStatus}
        />
      );

      await waitFor(() => {
        const voteCastEvents = screen.getAllByText("Vote Cast");
        expect(voteCastEvents.length).toBe(3);
      });

      // Check both vote types are shown
      expect(screen.getAllByText(/✓ Approve/i).length).toBe(2);
      expect(screen.getByText(/↩️ Refund/i)).toBeInTheDocument();
    });
  });
});
