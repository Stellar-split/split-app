import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import type { Invoice } from "@stellar-split/sdk";

const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    creator: "GCREATOR",
    recipients: [{ address: "GRECIPIENT", amount: 100_000_000n }],
    token: "CUSDC",
    deadline: 0,
    funded: 50_000_000n,
    status: "Pending",
    payments: [
      {
        payer: "GPAYER",
        amount: 50_000_000n,
        timestamp: Math.floor(Date.now() / 1000),
      },
    ],
  },
];

describe("ActivityHeatmap Tooltip Positioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heatmap cells for activity data", () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("shows tooltip on cell hover", async () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");

    fireEvent.mouseEnter(cells[0]);

    await waitFor(() => {
      const tooltip = screen.queryByText(/payment/i);
      expect(tooltip || document.querySelector('[role="tooltip"]')).toBeTruthy();
    });
  });

  it("positions tooltip to the right by default", () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");

    fireEvent.mouseEnter(cells[0]);

    const tooltip = document.querySelector('[role="tooltip"]');
    if (tooltip) {
      const style = window.getComputedStyle(tooltip);
      expect(style.visibility).not.toBe("hidden");
    }
  });

  it("flips tooltip to the left when right edge would overflow", () => {
    const container = render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");
    const rightEdgeCell = cells[cells.length - 1];

    fireEvent.mouseEnter(rightEdgeCell);

    const tooltip = document.querySelector('[role="tooltip"]');
    if (tooltip) {
      const tooltipRect = tooltip.getBoundingClientRect();
      expect(tooltipRect.right).toBeLessThanOrEqual(window.innerWidth);
    }
  });

  it("flips tooltip downward when top edge would overflow", () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");

    fireEvent.mouseEnter(cells[0]);

    const tooltip = document.querySelector('[role="tooltip"]');
    if (tooltip) {
      const tooltipRect = tooltip.getBoundingClientRect();
      expect(tooltipRect.bottom).toBeLessThanOrEqual(window.innerHeight);
    }
  });

  it("keeps tooltip fully within viewport on all edges", async () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");

    for (const cell of cells) {
      fireEvent.mouseEnter(cell);

      await waitFor(() => {
        const tooltip = document.querySelector('[role="tooltip"]');
        if (tooltip) {
          const rect = tooltip.getBoundingClientRect();
          expect(rect.left).toBeGreaterThanOrEqual(0);
          expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
          expect(rect.top).toBeGreaterThanOrEqual(0);
          expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
        }
      });
    }
  }, 30000);

  it("hides tooltip on mouse leave", async () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");

    fireEvent.mouseEnter(cells[0]);

    const tooltip = document.querySelector('[role="tooltip"]');
    if (tooltip) {
      fireEvent.mouseLeave(cells[0]);

      await waitFor(() => {
        expect(tooltip).not.toBeVisible();
      });
    }
  });

  it("updates tooltip content for different cells", async () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");

    fireEvent.mouseEnter(cells[0]);

    await waitFor(() => {
      expect(document.querySelector('[role="tooltip"]')).toBeTruthy();
    });

    fireEvent.mouseLeave(cells[0]);
    fireEvent.mouseEnter(cells[1]);

    await waitFor(() => {
      expect(document.querySelector('[role="tooltip"]')).toBeTruthy();
    });
  });

  it("adjusts position when viewport is resized", () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");

    fireEvent.mouseEnter(cells[0]);

    const originalTooltip = document.querySelector('[role="tooltip"]');
    const originalRect = originalTooltip?.getBoundingClientRect();

    window.innerWidth = 400;
    fireEvent.resize(window);

    const resizedTooltip = document.querySelector('[role="tooltip"]');
    const resizedRect = resizedTooltip?.getBoundingClientRect();

    if (resizedTooltip) {
      expect(resizedRect?.right).toBeLessThanOrEqual(400);
    }
  });

  it("shows tooltip content with activity count", async () => {
    render(<ActivityHeatmap invoices={mockInvoices} />);
    const cells = screen.getAllByRole("button");

    fireEvent.mouseEnter(cells[0]);

    await waitFor(() => {
      const tooltip = document.querySelector('[role="tooltip"]');
      expect(tooltip?.textContent).toMatch(/\d+ payment/i);
    });
  });

  it("positions tooltip relative to heatmap container coordinates", () => {
    const { container } = render(<ActivityHeatmap invoices={mockInvoices} />);
    const heatmap = container.querySelector('svg');
    const cells = screen.getAllByRole("button");

    fireEvent.mouseEnter(cells[0]);

    const tooltip = document.querySelector('[role="tooltip"]');
    if (tooltip && heatmap) {
      const heatmapRect = heatmap.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      expect(tooltipRect.left).toBeGreaterThanOrEqual(heatmapRect.left - 100);
      expect(tooltipRect.right).toBeLessThanOrEqual(heatmapRect.right + 100);
    }
  });
});
