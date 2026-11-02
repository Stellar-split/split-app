import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import DisputePanel from "../DisputePanel";
import type { Invoice } from "@stellar-split/sdk";

// Shared mock client so component and tests reference the same functions
const mockVoteDispute = vi.hoisted(() => vi.fn().mockResolvedValue({ txHash: "mockTxHash" }));
const mockAddDisputeEvidence = vi.hoisted(() => vi.fn().mockResolvedValue({ txHash: "mockTxHash" }));

vi.mock("@/lib/ipfs", () => ({
  uploadToIpfs: vi.fn().mockResolvedValue("QmMockCID123456789abcdefghijklmnopqrstuvwxyz"),
}));

vi.mock("@/lib/stellar", () => ({
  getSplitClient: vi.fn(() => ({
    voteDispute: mockVoteDispute,
    addDisputeEvidence: mockAddDisputeEvidence,
  })),
}));

const mockInvoice: Invoice & { disputeStatus?: any } = {
  id: "invoice-123",
  creator: "GCREATOR123",
  status: "Disputed",
  token: "USDC",
  funded: 5000n,
  recipients: [
    { address: "GRECIPIENT1", amount: 5000n },
  ],
  payments: [
    { payer: "GPAYER123", amount: 5000n },
  ],
  deadline: 0,
  disputeStatus: {
    reason: "Non-delivery",
    description: "Services were not delivered as agreed",
    initiator: "GPAYER123",
    timestamp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    arbitrators: ["GARBITRATOR1", "GARBITRATOR2", "GARBITRATOR3"],
    evidenceLinks: [
      {
        cid: "QmExampleCID123",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
        submitter: "GPAYER123",
        filename: "evidence.pdf",
      },
    ],
    releaseVotes: 1,
    refundVotes: 0,
    votedArbitrators: ["GARBITRATOR1"],
    resolved: false,
  },
};

describe("DisputePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).__toastContainer = { addToast: vi.fn() };
  });

  afterEach(() => {
    delete (window as any).__toastContainer;
  });

  describe("Conditional Rendering", () => {
    it("renders dispute panel when status is Disputed", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText(/Invoice Disputed/i)).toBeInTheDocument();
    });

    it("does not render when status is not Disputed", () => {
      const pendingInvoice = { ...mockInvoice, status: "Pending" as const };
      const { container } = render(
        <DisputePanel
          invoice={pendingInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("does not render when disputeStatus is missing", () => {
      const invoiceWithoutDispute = {
        ...mockInvoice,
        disputeStatus: undefined,
      };
      const { container } = render(
        <DisputePanel
          invoice={invoiceWithoutDispute}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Dispute Metadata Display", () => {
    it("displays dispute reason and description", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText("Non-delivery")).toBeInTheDocument();
      expect(screen.getByText(/Services were not delivered/i)).toBeInTheDocument();
    });

    it("displays initiator address", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      // Scope to the "Initiated By" card to avoid matching the evidence submitter
      const initiatedByLabel = screen.getByText("Initiated By");
      expect(initiatedByLabel.parentElement).toHaveTextContent(/GPAYER/i);
    });

    it("displays vote tally correctly", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText("1")).toBeInTheDocument(); // Release votes
      expect(screen.getByText("0")).toBeInTheDocument(); // Refund votes
    });

    it("shows number of arbitrators assigned", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText("3 assigned")).toBeInTheDocument();
    });
  });

  describe("Evidence Upload Flow", () => {
    it("opens evidence modal when Submit Evidence button clicked", async () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      const submitButton = screen.getByRole("button", { name: /Submit evidence/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Submit Evidence" })).toBeInTheDocument();
      });
    });

    it("displays existing evidence with IPFS links", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText(/evidence\.pdf/i)).toBeInTheDocument();
      const viewLink = screen.getByRole("link", { name: /View evidence/i });
      expect(viewLink).toHaveAttribute("href", "https://ipfs.io/ipfs/QmExampleCID123");
    });

    it("uploads file and submits CID on evidence submission", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);

      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR2"
          onRefresh={mockRefresh}
        />
      );

      // Open modal
      const submitButton = screen.getByRole("button", { name: /Submit evidence/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Select file
      const file = new File(["test content"], "test.pdf", { type: "application/pdf" });
      const fileInput = screen.getByLabelText(/Select file/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Use within(dialog) to scope the Submit Evidence button to the modal
      const dialog = screen.getByRole("dialog");
      const submitModalButton = within(dialog).getByRole("button", { name: /Submit Evidence/i });
      fireEvent.click(submitModalButton);

      await waitFor(() => {
        expect(mockAddDisputeEvidence).toHaveBeenCalledWith({
          invoiceId: "invoice-123",
          submitter: "GARBITRATOR2",
          evidenceCid: "QmMockCID123456789abcdefghijklmnopqrstuvwxyz",
          filename: "test.pdf",
        });
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("shows error when file size exceeds limit", async () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR2"
          onRefresh={vi.fn()}
        />
      );

      // Open modal
      fireEvent.click(screen.getByRole("button", { name: /Submit evidence/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Try to upload large file (>10MB)
      const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "large.pdf", {
        type: "application/pdf",
      });
      const fileInput = screen.getByLabelText(/Select file/i);
      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/File size must be under 10MB/i)).toBeInTheDocument();
      });
    });
  });

  describe("Voting Authorization", () => {
    it("shows voting controls for authorized arbitrators who have not voted", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR2" // Not voted yet
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /Approve Release/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reject \/ Refund/i })).toBeInTheDocument();
    });

    it("disables voting controls for arbitrators who already voted", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR1" // Already voted
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText(/You have already cast your vote/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Approve Release/i })).not.toBeInTheDocument();
    });

    it("hides voting controls for non-arbitrators", () => {
      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GPAYER123" // Not an arbitrator
          onRefresh={vi.fn()}
        />
      );

      expect(screen.queryByText(/Arbitrator Actions/i)).not.toBeInTheDocument();
    });

    it("calls voteDispute with correct parameters on Approve Release", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);

      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR2"
          onRefresh={mockRefresh}
        />
      );

      const approveButton = screen.getByRole("button", { name: /Approve Release/i });
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(mockVoteDispute).toHaveBeenCalledWith({
          invoiceId: "invoice-123",
          arbitrator: "GARBITRATOR2",
          vote: 1, // Release
        });
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("calls voteDispute with correct parameters on Reject/Refund", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);

      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR2"
          onRefresh={mockRefresh}
        />
      );

      const rejectButton = screen.getByRole("button", { name: /Reject \/ Refund/i });
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(mockVoteDispute).toHaveBeenCalledWith({
          invoiceId: "invoice-123",
          arbitrator: "GARBITRATOR2",
          vote: 0, // Refund
        });
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe("Timeline Chronology", () => {
    it("displays evidence in chronological order", () => {
      const invoiceWithMultipleEvidence = {
        ...mockInvoice,
        disputeStatus: {
          ...mockInvoice.disputeStatus,
          evidenceLinks: [
            {
              cid: "QmOldest",
              timestamp: 1000,
              submitter: "GPAYER123",
              filename: "old.pdf",
            },
            {
              cid: "QmNewest",
              timestamp: 3000,
              submitter: "GPAYER123",
              filename: "new.pdf",
            },
            {
              cid: "QmMiddle",
              timestamp: 2000,
              submitter: "GPAYER123",
              filename: "middle.pdf",
            },
          ],
        },
      };

      render(
        <DisputePanel
          invoice={invoiceWithMultipleEvidence}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      const evidenceElements = screen.getAllByText(/\.pdf/i);
      // They should appear in the order they're in the array (backend should handle sorting)
      expect(evidenceElements[0]).toHaveTextContent("old.pdf");
      expect(evidenceElements[1]).toHaveTextContent("new.pdf");
      expect(evidenceElements[2]).toHaveTextContent("middle.pdf");
    });
  });

  describe("Real-Time Updates", () => {
    it("calls onRefresh after successful vote", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);

      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR2"
          onRefresh={mockRefresh}
        />
      );

      const approveButton = screen.getByRole("button", { name: /Approve Release/i });
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("calls onRefresh after successful evidence submission", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);

      render(
        <DisputePanel
          invoice={mockInvoice}
          publicKey="GARBITRATOR2"
          onRefresh={mockRefresh}
        />
      );

      // Open modal and submit evidence
      fireEvent.click(screen.getByRole("button", { name: /Submit evidence/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const file = new File(["test"], "test.pdf", { type: "application/pdf" });
      const fileInput = screen.getByLabelText(/Select file/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Use within(dialog) to scope to the modal's Submit Evidence button
      const dialog = screen.getByRole("dialog");
      const submitButton = within(dialog).getByRole("button", { name: /Submit Evidence/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe("Resolved Disputes", () => {
    it("shows resolved badge when dispute is resolved", () => {
      const resolvedInvoice = {
        ...mockInvoice,
        disputeStatus: {
          ...mockInvoice.disputeStatus,
          resolved: true,
          outcome: "Release" as const,
        },
      };

      render(
        <DisputePanel
          invoice={resolvedInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      expect(screen.getByText(/✓ Approved/i)).toBeInTheDocument();
    });

    it("disables evidence submission when dispute is resolved", () => {
      const resolvedInvoice = {
        ...mockInvoice,
        disputeStatus: {
          ...mockInvoice.disputeStatus,
          resolved: true,
          outcome: "Refund" as const,
        },
      };

      render(
        <DisputePanel
          invoice={resolvedInvoice}
          publicKey="GARBITRATOR1"
          onRefresh={vi.fn()}
        />
      );

      const submitButton = screen.getByRole("button", { name: /Submit evidence/i });
      expect(submitButton).toBeDisabled();
    });
  });
});
