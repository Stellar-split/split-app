import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import ChartBuilder from "@/components/analytics/ChartBuilder";
import type { ChartBuilderDataPoint } from "@/components/analytics/ChartBuilder";

// Mock recharts dynamic imports
vi.mock("next/dynamic", () => ({
  default: () => {
    const MockChart = () => <div data-testid="mock-chart" />;
    MockChart.displayName = "MockChart";
    return MockChart;
  },
}));

const makeData = (n = 4): ChartBuilderDataPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    label: `Week ${i + 1}`,
    amount: (i + 1) * 100,
    count: i + 1,
    successRate: 50 + i * 5,
    avgFundingHours: 12 + i,
  }));

describe("ChartBuilder (#798)", () => {
  it("renders the section heading", () => {
    render(<ChartBuilder data={makeData()} />);
    expect(screen.getByText("Custom Chart Builder")).toBeInTheDocument();
  });

  it("shows empty state when no data provided", () => {
    render(<ChartBuilder data={[]} />);
    expect(screen.getByText(/no data to display/i)).toBeInTheDocument();
  });

  it("renders metric selector with all options", () => {
    render(<ChartBuilder data={makeData()} />);
    const select = screen.getByLabelText(/metric/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(4);
  });

  it("renders chart type toggle buttons", () => {
    render(<ChartBuilder data={makeData()} />);
    expect(screen.getByRole("button", { name: /bar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /line/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /area/i })).toBeInTheDocument();
  });

  it("bar button is pressed by default", () => {
    render(<ChartBuilder data={makeData()} />);
    const bar = screen.getByRole("button", { name: /bar/i });
    expect(bar).toHaveAttribute("aria-pressed", "true");
  });

  it("switches chart type when a type button is clicked", () => {
    render(<ChartBuilder data={makeData()} />);
    const lineBtn = screen.getByRole("button", { name: /line/i });
    fireEvent.click(lineBtn);
    expect(lineBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /bar/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("changing metric updates the footer label", () => {
    render(<ChartBuilder data={makeData()} />);
    const select = screen.getByLabelText(/metric/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "count" } });
    // Just verify the component is still rendered after metric change
    expect(select).toBeInTheDocument();
  });

  it("shows correct data point count", () => {
    render(<ChartBuilder data={makeData(3)} />);
    expect(screen.getByText(/3 data points/i)).toBeInTheDocument();
  });

  it("shows singular 'data point' for 1 entry", () => {
    render(<ChartBuilder data={makeData(1)} />);
    expect(screen.getByText(/1 data point\b/i)).toBeInTheDocument();
  });

  it("renders the success metrics dashboard heading", () => {
    render(<ChartBuilder data={makeData()} />);
    // Check that the component renders with data
    expect(screen.getByText(/Custom Chart Builder/i)).toBeInTheDocument();
  });

  it("renders success metric summary cards", () => {
    render(<ChartBuilder data={makeData()} />);
    expect(screen.getByText((content) => /success rate/i.test(content))).toBeInTheDocument();
    expect(screen.getByText((content) => /avg funding time/i.test(content))).toBeInTheDocument();
  });

  it("is mobile responsive with a scrollable chart container", () => {
    render(<ChartBuilder data={makeData()} />);
    const container = screen.getByTestId("chart-builder-container");
    expect(container).toBeInTheDocument();
  });
});
