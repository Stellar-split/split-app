import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StatusPieChart from "@/components/analytics/StatusPieChart";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe("StatusPieChart", () => {
  it("renders the chart with aria-label", () => {
    render(
      <StatusPieChart
        data={[
          { name: "Released", value: 5 },
          { name: "Refunded", value: 2 },
        ]}
      />
    );
    expect(
      screen.getByRole("figure", { name: "Invoice status breakdown chart" })
    ).toBeInTheDocument();
  });

  it("renders pie chart with data", () => {
    render(
      <StatusPieChart
        data={[
          { name: "Released", value: 5 },
          { name: "Refunded", value: 2 },
          { name: "Active", value: 3 },
        ]}
      />
    );
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("shows 'No data available' when all values are zero", () => {
    render(
      <StatusPieChart
        data={[
          { name: "Released", value: 0 },
          { name: "Refunded", value: 0 },
        ]}
      />
    );
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("shows 'No data available' when data is empty array", () => {
    render(<StatusPieChart data={[]} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
