import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import UniquePayersChart from "@/components/analytics/UniquePayersChart";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

describe("UniquePayersChart", () => {
  it("renders the chart with aria-label", () => {
    render(
      <UniquePayersChart data={[{ label: "Jan 6", count: 3 }]} />
    );
    expect(
      screen.getByRole("figure", { name: "Unique payers over time chart" })
    ).toBeTruthy() // element exists in DOM;
  });

  it("renders line chart with data", () => {
    render(
      <UniquePayersChart
        data={[
          { label: "Jan 6", count: 3 },
          { label: "Jan 13", count: 7 },
        ]}
      />
    );
    expect(screen.getByTestId("line-chart")).toBeTruthy() // element exists in DOM;
    expect(screen.getByTestId("responsive-container")).toBeTruthy() // element exists in DOM;
  });

  it("shows 'No data available' when data is empty", () => {
    render(<UniquePayersChart data={[]} />);
    expect(screen.getByText("No data available")).toBeTruthy() // element exists in DOM;
  });
});
