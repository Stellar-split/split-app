import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StatusBadge from "@/components/StatusBadge";
import { STATUS_CONFIG } from "@/lib/invoiceStatus";

describe("StatusBadge", () => {
  test("renders status label correctly", () => {
    render(<StatusBadge status="Pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  test("applies correct color class based on status", () => {
    render(<StatusBadge status="Released" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveClass("bg-green-500/20", "text-green-400");
  });

  test("renders icon when available", () => {
    render(<StatusBadge status="Released" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("✓");
  });

  test("includes status and description in aria-label", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute(
      "aria-label",
      `Status: Pending — ${STATUS_CONFIG.Pending.description}`
    );
  });

  test("shows tooltip on mouse hover", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(badge);

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText(STATUS_CONFIG.Pending.description)).toBeInTheDocument();
  });

  test("hides tooltip on mouse leave", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");

    fireEvent.mouseEnter(badge);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(badge);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("shows tooltip on focus for keyboard accessibility", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(badge);

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  test("hides tooltip on blur", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");

    fireEvent.focus(badge);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(badge);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  test("uses custom description when provided", () => {
    const customDescription = "This is a custom description";
    render(<StatusBadge status="Pending" description={customDescription} />);
    const badge = screen.getByRole("status");

    fireEvent.mouseEnter(badge);
    expect(screen.getByText(customDescription)).toBeInTheDocument();
    expect(screen.queryByText(STATUS_CONFIG.Pending.description)).not.toBeInTheDocument();
  });

  test("applies correct size classes", () => {
    const { rerender } = render(<StatusBadge status="Pending" size="sm" />);
    expect(screen.getByRole("status")).toHaveClass("text-xs", "px-2", "py-0.5");

    rerender(<StatusBadge status="Pending" size="md" />);
    expect(screen.getByRole("status")).toHaveClass("text-sm", "px-3", "py-1");

    rerender(<StatusBadge status="Pending" size="lg" />);
    expect(screen.getByRole("status")).toHaveClass("text-base", "px-4", "py-1.5");
  });

  test("badge is focusable with tabIndex", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("tabIndex", "0");
  });

  test("all status types render without error", () => {
    const statuses: (keyof typeof STATUS_CONFIG)[] = [
      "Pending",
      "Active",
      "Funded",
      "Released",
      "Refunded",
      "Disputed",
      "Frozen",
      "Archived",
      "Expired",
    ];

    statuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(STATUS_CONFIG[status].label)).toBeInTheDocument();
      unmount();
    });
  });
});
