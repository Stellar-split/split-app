import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InvoiceCalendar from "@/components/InvoiceCalendar";
import { buildMonthGrid, groupByDeadline } from "@/lib/invoiceCalendar";

const ts = (y: number, m: number, d: number) => Math.floor(new Date(y, m, d, 12).getTime() / 1000);
const invoices = [
  { id: "1", deadline: ts(2026, 8, 15), status: "Pending" },
  { id: "2", deadline: ts(2026, 8, 15), status: "Released" },
  { id: "3", deadline: 0, status: "Pending" },
];

describe("invoiceCalendar lib", () => {
  it("groups by deadline day and skips missing deadlines", () => {
    const grouped = groupByDeadline(invoices);
    expect(grouped.get("2026-09-15")?.map((i) => i.id)).toEqual(["1", "2"]);
    expect(grouped.size).toBe(1);
  });

  it("builds a 42-day grid starting on Sunday", () => {
    const grid = buildMonthGrid(2026, 8, invoices);
    expect(grid).toHaveLength(42);
    expect(grid[0].date.getDay()).toBe(0);
    expect(grid.find((d) => d.key === "2026-09-15")?.invoices).toHaveLength(2);
  });
});

describe("InvoiceCalendar", () => {
  it("shows invoices for a selected day and navigates months", () => {
    render(<InvoiceCalendar invoices={invoices} initialDate={new Date(2026, 8, 1)} />);
    expect(screen.getByText(/September 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Sep 15 2026, 2 invoices due/));
    expect(screen.getByTestId("calendar-day-detail")).toHaveTextContent("Invoice #1");
    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.getByText(/October 2026/)).toBeInTheDocument();
  });
});
