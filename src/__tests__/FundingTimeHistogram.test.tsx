import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FundingTimeHistogram from "@/components/analytics/FundingTimeHistogram";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

describe("FundingTimeHistogram", () => {
  it("renders the chart with aria-label", () => {
    render(
      <FundingTimeHistogram data={[{ label: "0-12h", count: 4 }]} />
    );
    expect(
      screen.getByRole("figure", { name: "Average funding time histogram" })
    ).toBeInTheDocument();
  });

  it("renders bar chart with histogram data", () => {
    render(
      <FundingTimeHistogram
        data={[
          { label: "0-12h", count: 4 },
          { label: "12-24h", count: 8 },
          { label: "24-48h", count: 3 },
        ]}
      />
    );
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("shows 'No data available' when data is empty", () => {
    render(<FundingTimeHistogram data={[]} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
