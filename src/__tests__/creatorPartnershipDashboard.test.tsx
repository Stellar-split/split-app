import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CreatorPartnershipDashboard from "@/components/CreatorPartnershipDashboard";
import {
  computeMetrics,
  collaborationStats,
  buildTrends,
  exportMetricsCsv,
  exportStatsCsv,
  type PartnershipInvoice,
} from "@/lib/creatorPartnershipDashboard";

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const invoices: PartnershipInvoice[] = [
  { invoiceId: "1", partnerAddress: "GPARTNER_A", amount: 100, settledAt: NOW - 1 * DAY },
  { invoiceId: "2", partnerAddress: "GPARTNER_A", amount: 200, settledAt: NOW - 2 * DAY },
  { invoiceId: "3", partnerAddress: "GPARTNER_B", amount: 300, settledAt: NOW - 40 * DAY },
];

describe("creatorPartnershipDashboard metrics", () => {
  it("computes headline metrics", () => {
    const m = computeMetrics(invoices, NOW);
    expect(m.totalPartnerships).toBe(2);
    expect(m.activePartnerships).toBe(1); // only GPARTNER_A within 30 days
    expect(m.totalInvoices).toBe(3);
    expect(m.totalVolume).toBe(600);
    expect(m.averageDealSize).toBe(200);
  });

  it("computes per-partner collaboration stats, most active first", () => {
    const stats = collaborationStats(invoices);
    expect(stats[0].partnerAddress).toBe("GPARTNER_A");
    expect(stats[0].collaborations).toBe(2);
    expect(stats[0].volume).toBe(300);
    expect(stats[1].partnerAddress).toBe("GPARTNER_B");
  });

  it("builds period-over-period trends", () => {
    const trends = buildTrends(invoices, DAY, 3, NOW);
    expect(trends).toHaveLength(3);
    // Only the two recent invoices fall within the 3-day window.
    const totalVolume = trends.reduce((sum, p) => sum + p.volume, 0);
    expect(totalVolume).toBe(300);
  });

  it("exports metrics and stats as CSV", () => {
    const m = computeMetrics(invoices, NOW);
    const csv = exportMetricsCsv(m);
    expect(csv.split("\n")[0]).toBe("Metric,Value");
    expect(csv).toContain("Total Partnerships,2");

    const statsCsv = exportStatsCsv(collaborationStats(invoices));
    expect(statsCsv.split("\n")[0]).toBe(
      "Partner,Collaborations,Volume,Last Active"
    );
  });
});

describe("CreatorPartnershipDashboard component", () => {
  beforeEach(() => {
    (URL as any).createObjectURL = vi.fn(() => "blob:mock");
    (URL as any).revokeObjectURL = vi.fn();
  });

  it("renders metrics, stats, and trends", () => {
    render(<CreatorPartnershipDashboard invoices={invoices} now={NOW} />);
    expect(screen.getByTestId("metric-total-partnerships").textContent).toContain("2");
    expect(screen.getByTestId("metric-total-volume").textContent).toContain("600");
    expect(screen.getAllByTestId("partner-row")).toHaveLength(2);
    expect(screen.getAllByTestId("trend-point")).toHaveLength(6);
  });

  it("exports a CSV when the export button is clicked", () => {
    render(<CreatorPartnershipDashboard invoices={invoices} now={NOW} />);
    fireEvent.click(screen.getByText("Export metrics CSV"));
    expect((URL as any).createObjectURL).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Exported metrics CSV");
  });
});