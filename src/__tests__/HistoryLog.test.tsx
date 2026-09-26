import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistoryLog, {
  filterHistoryEntries,
  formatRelativeTime,
  type HistoryEntry,
} from "@/components/invoice/HistoryLog";

describe("HistoryLog & Filter Logic", () => {
  const mockEntries: HistoryEntry[] = [
    {
      id: "1",
      eventType: "payment",
      actor: "GBZXN7PIRZGNMHGA728J352Q367AZ2Q2V55HQ2BEXD7J7",
      amount: "150.00",
      currency: "USDC",
      details: "Contribution received",
      timestamp: 1700000000000,
    },
    {
      id: "2",
      eventType: "release",
      actor: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7",
      details: "Funds released to recipients",
      timestamp: 1700003600000,
    },
    {
      id: "3",
      eventType: "note",
      actor: "GBZXN7PIRZGNMHGA728J352Q367AZ2Q2V55HQ2BEXD7J7",
      details: "Memo attached to payment",
      timestamp: 1700007200000,
    },
    {
      id: "4",
      eventType: "status_change",
      actor: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7",
      details: "Status updated from Pending to Fully Funded",
      timestamp: 1700010800000,
    },
  ];

  describe("filterHistoryEntries pure function", () => {
    it("returns all entries when filter is 'all'", () => {
      const filtered = filterHistoryEntries(mockEntries, "all");
      expect(filtered).toHaveLength(4);
    });

    it("filters only payments when filter is 'payments'", () => {
      const filtered = filterHistoryEntries(mockEntries, "payments");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].eventType).toBe("payment");
    });

    it("filters only releases when filter is 'releases'", () => {
      const filtered = filterHistoryEntries(mockEntries, "releases");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].eventType).toBe("release");
    });

    it("filters only notes when filter is 'notes'", () => {
      const filtered = filterHistoryEntries(mockEntries, "notes");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].eventType).toBe("note");
    });

    it("filters only status changes when filter is 'status_changes'", () => {
      const filtered = filterHistoryEntries(mockEntries, "status_changes");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].eventType).toBe("status_change");
    });
  });

  describe("formatRelativeTime helper", () => {
    const fixedNow = 1700000000000;

    it("returns 'just now' for events within 60 seconds", () => {
      expect(formatRelativeTime(fixedNow - 30 * 1000, fixedNow)).toBe("just now");
    });

    it("returns minutes ago for events within the hour", () => {
      expect(formatRelativeTime(fixedNow - 15 * 60 * 1000, fixedNow)).toBe("15m ago");
    });

    it("returns hours ago for events within 24 hours", () => {
      expect(formatRelativeTime(fixedNow - 4 * 3600 * 1000, fixedNow)).toBe("4h ago");
    });

    it("returns days ago for older events", () => {
      expect(formatRelativeTime(fixedNow - 3 * 86400 * 1000, fixedNow)).toBe("3d ago");
    });
  });

  describe("HistoryLog component", () => {
    it("renders all entries initially with All filter active", () => {
      render(<HistoryLog invoiceId="test-1" initialEntries={mockEntries} />);

      expect(screen.getByText("On-Chain History Log")).toBeInTheDocument();
      expect(screen.getByText("Payment")).toBeInTheDocument();
      expect(screen.getByText("Release")).toBeInTheDocument();
      expect(screen.getByText("Note")).toBeInTheDocument();
      expect(screen.getByText("Status Change")).toBeInTheDocument();
    });

    it("filters list when a filter chip is clicked", () => {
      render(<HistoryLog invoiceId="test-1" initialEntries={mockEntries} />);

      const paymentsChip = screen.getByRole("tab", { name: "Payments" });
      fireEvent.click(paymentsChip);

      expect(screen.getByText("Payment")).toBeInTheDocument();
      expect(screen.queryByText("Release")).not.toBeInTheDocument();
      expect(screen.queryByText("Note")).not.toBeInTheDocument();
    });

    it("shows empty state when filter matches no entries", () => {
      const entriesWithoutNotes: HistoryEntry[] = [mockEntries[0]];
      render(<HistoryLog invoiceId="test-1" initialEntries={entriesWithoutNotes} />);

      const notesChip = screen.getByRole("tab", { name: "Notes" });
      fireEvent.click(notesChip);

      expect(screen.getByText("No history yet")).toBeInTheDocument();
    });

    it("toggles compact timeline view", () => {
      render(<HistoryLog invoiceId="test-1" initialEntries={mockEntries} />);

      const toggleButton = screen.getByRole("button", { name: /compact timeline/i });
      fireEvent.click(toggleButton);

      expect(screen.getByRole("button", { name: /detailed view/i })).toBeInTheDocument();
    });

    it("provides JSON export button", () => {
      render(<HistoryLog invoiceId="test-1" initialEntries={mockEntries} />);

      const exportButton = screen.getByRole("button", { name: /export history as json/i });
      expect(exportButton).toBeInTheDocument();
    });
  });
});
