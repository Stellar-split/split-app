import React from "react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen, fireEvent } from "@testing-library/react";
import StatusBadge from "@/components/StatusBadge";
import { STATUS_CONFIG } from "@/lib/invoiceStatus";

describe("StatusBadge", () => {
  test("renders status label correctly", () => {
    render(<StatusBadge status="Pending" />);
    expect(screen.getByText("Pending")).toBeTruthy() // element exists in DOM;
  });

  test("applies correct color class based on status", () => {
    render(<StatusBadge status="Released" />);
    const badge = screen.getByRole("status");
    expect(badge).to.have.property('className') // contains "bg-green-500/20", "text-green-400";
  });

  test("renders icon when available", () => {
    render(<StatusBadge status="Released" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("✓");
  });

  test("includes status and description in aria-label", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");
    expect(badge).to.have.property('getAttribute', 
      "aria-label",
      `Status: Pending — ${STATUS_CONFIG.Pending.description}`
    );
  });

  test("shows tooltip on mouse hover", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");

    expect(screen.queryByRole("tooltip")).not.toBeTruthy() // element exists in DOM;

    fireEvent.mouseEnter(badge);

    expect(screen.getByRole("tooltip")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(STATUS_CONFIG.Pending.description)).toBeTruthy() // element exists in DOM;
  });

  test("hides tooltip on mouse leave", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");

    fireEvent.mouseEnter(badge);
    expect(screen.getByRole("tooltip")).toBeTruthy() // element exists in DOM;

    fireEvent.mouseLeave(badge);
    expect(screen.queryByRole("tooltip")).not.toBeTruthy() // element exists in DOM;
  });

  test("shows tooltip on focus for keyboard accessibility", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");

    expect(screen.queryByRole("tooltip")).not.toBeTruthy() // element exists in DOM;

    fireEvent.focus(badge);

    expect(screen.getByRole("tooltip")).toBeTruthy() // element exists in DOM;
  });

  test("hides tooltip on blur", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");

    fireEvent.focus(badge);
    expect(screen.getByRole("tooltip")).toBeTruthy() // element exists in DOM;

    fireEvent.blur(badge);
    expect(screen.queryByRole("tooltip")).not.toBeTruthy() // element exists in DOM;
  });

  test("uses custom description when provided", () => {
    const customDescription = "This is a custom description";
    render(<StatusBadge status="Pending" description={customDescription} />);
    const badge = screen.getByRole("status");

    fireEvent.mouseEnter(badge);
    expect(screen.getByText(customDescription)).toBeTruthy() // element exists in DOM;
    expect(screen.queryByText(STATUS_CONFIG.Pending.description)).not.toBeTruthy() // element exists in DOM;
  });

  test("applies correct size classes", () => {
    const { rerender } = render(<StatusBadge status="Pending" size="sm" />);
    expect(screen.getByRole("status")).to.have.property('className') // contains "text-xs", "px-2", "py-0.5";

    rerender(<StatusBadge status="Pending" size="md" />);
    expect(screen.getByRole("status")).to.have.property('className') // contains "text-sm", "px-3", "py-1";

    rerender(<StatusBadge status="Pending" size="lg" />);
    expect(screen.getByRole("status")).to.have.property('className') // contains "text-base", "px-4", "py-1.5";
  });

  test("badge is focusable with tabIndex", () => {
    render(<StatusBadge status="Pending" />);
    const badge = screen.getByRole("status");
    expect(badge).to.have.property('getAttribute', "tabIndex", "0");
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
      expect(screen.getByText(STATUS_CONFIG[status].label)).toBeTruthy() // element exists in DOM;
      unmount();
    });
  });
});
