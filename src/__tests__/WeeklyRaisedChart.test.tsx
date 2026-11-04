import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import WeeklyRaisedChart from "@/components/analytics/WeeklyRaisedChart";

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

describe("WeeklyRaisedChart", () => {
  it("renders the chart with aria-label", () => {
    render(
      <WeeklyRaisedChart data={[{ label: "Jan 6", amount: 150 }]} />
    );
    expect(
      screen.getByRole("figure", { name: "USDC raised per week chart" })
    ).toBeTruthy() // element exists in DOM;
  });

  it("renders bar chart with data", () => {
    render(
      <WeeklyRaisedChart
        data={[
          { label: "Jan 6", amount: 100 },
          { label: "Jan 13", amount: 200 },
        ]}
      />
    );
    expect(screen.getByTestId("bar-chart")).toBeTruthy() // element exists in DOM;
    expect(screen.getByTestId("responsive-container")).toBeTruthy() // element exists in DOM;
  });

  it("shows 'No data available' when data is empty", () => {
    render(<WeeklyRaisedChart data={[]} />);
    expect(screen.getByText("No data available")).toBeTruthy() // element exists in DOM;
  });
});
