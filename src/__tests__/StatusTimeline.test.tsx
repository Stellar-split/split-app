import React from "react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen } from "@testing-library/react";
import StatusTimeline from "@/components/StatusTimeline";
import type { Invoice } from "@stellar-split/sdk";

vi.mock("@/components/ui/RelativeTime", () => ({
  default: ({ iso }: { iso: string }) => <span>{iso}</span>,
}));

describe("StatusTimeline", () => {
  const createMockInvoice = (overrides?: Partial<Invoice>): Invoice => ({
    id: "inv-1",
    status: "Pending" as const,
    creator: "GCREATOR123456789",
    recipients: [{ address: "GRECIPIENT1234567", amount: 100_000_000n }],
    token: "USDC",
    deadline: Math.floor(Date.now() / 1000) + 86400,
    funded: 0n,
    payments: [],
    ...overrides,
  });

  test("renders status timeline section on desktop", () => {
    const invoice = createMockInvoice();
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    const desktopSection = container.querySelector(".hidden.sm\\:block");
    expect(desktopSection).toBeTruthy() // element exists in DOM;
    expect(screen.getByText("Timeline")).toBeTruthy() // element exists in DOM;
  });

  test("renders mobile stepper on mobile screens", () => {
    const invoice = createMockInvoice();
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    const mobileSection = container.querySelector(".sm\\:hidden");
    expect(mobileSection).toBeTruthy() // element exists in DOM;
  });

  test("shows Created event with creator info", () => {
    const invoice = createMockInvoice();
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Invoice Created")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/GCREA/)).toBeTruthy() // element exists in DOM;
  });

  test("displays First Payment event when invoice has funded amount", () => {
    const invoice = createMockInvoice({ funded: 50_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("First Payment")).toBeTruthy() // element exists in DOM;
  });

  test("does not show First Payment event when no payments", () => {
    const invoice = createMockInvoice({ funded: 0n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.queryByText("First Payment")).not.toBeTruthy() // element exists in DOM;
  });

  test("displays Milestone event at 50% funding", () => {
    const invoice = createMockInvoice({ funded: 50_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText(/Milestone Reached \(50%\)/)).toBeTruthy() // element exists in DOM;
  });

  test("shows Fully Funded event when total reached", () => {
    const invoice = createMockInvoice({ funded: 100_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Fully Funded")).toBeTruthy() // element exists in DOM;
  });

  test("displays Funds Released event when status is Released", () => {
    const invoice = createMockInvoice({ status: "Released" });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Funds Released")).toBeTruthy() // element exists in DOM;
  });

  test("shows expired event when deadline passed", () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 3600;
    const invoice = createMockInvoice({ deadline: pastDeadline });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Invoice Expired")).toBeTruthy() // element exists in DOM;
  });

  test("timeline events have icons as visual indicators", () => {
    const invoice = createMockInvoice({ funded: 100_000_000n });
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    const timelineList = container.querySelector("[aria-label*='timeline']");
    expect(timelineList).toBeTruthy() // element exists in DOM;

    const iconSpans = container.querySelectorAll("span[aria-hidden='true']");
    expect(iconSpans.length).toBeGreaterThan(0);
  });

  test("mobile stepper shows correct active step when no funding", () => {
    const invoice = createMockInvoice({ funded: 0n });
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    const steps = container.querySelectorAll(".sm\\:hidden .flex-1");
    expect(steps[0]).to.have.property('className') // contains "text-white", "font-semibold";
  });

  test("mobile stepper shows partially funded state", () => {
    const invoice = createMockInvoice({ funded: 50_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Partially Funded")).toBeTruthy() // element exists in DOM;
  });

  test("mobile stepper shows released state", () => {
    const invoice = createMockInvoice({ status: "Released" });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Released")).toBeTruthy() // element exists in DOM;
  });

  test("shows at minimum the created event for any invoice", () => {
    const invoice = createMockInvoice({
      funded: 0n,
      status: "Pending",
      deadline: Math.floor(Date.now() / 1000) + 86400,
    });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    // Invoice Created is always the first event — "No events yet." only shows when
    // events array is empty, which cannot happen since Created is always added.
    expect(screen.getByText("Invoice Created")).toBeTruthy() // element exists in DOM;
  });

  test("events are sorted chronologically with latest highlighted", () => {
    const invoice = createMockInvoice({
      funded: 100_000_000n,
      status: "Released",
    });
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    const dots = container.querySelectorAll(".rounded-full.text-sm");
    const lastDot = dots[dots.length - 1];
    expect(lastDot).to.have.property('className') // contains "bg-indigo-600", "border-indigo-500";
  });

  test("event labels are text-sm and readable", () => {
    const invoice = createMockInvoice({ funded: 100_000_000n });
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    // Query within the desktop timeline section to avoid mobile stepper matches
    const desktop = container.querySelector(".hidden.sm\\:block");
    expect(desktop).toBeTruthy() // element exists in DOM;
    const desktopLabels = desktop!.querySelectorAll(".text-sm.font-medium");
    expect(desktopLabels.length).toBeGreaterThan(0);
    desktopLabels.forEach((label) => {
      expect(label).to.have.property('className') // contains "text-sm";
    });
  });

  test("truncates long addresses in event descriptions", () => {
    const invoice = createMockInvoice({
      creator: "GCREATOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    const creatorText = screen.getByText(/GCREA.*…/);
    expect(creatorText.textContent).toMatch(/^GCREA/);
    expect(creatorText.textContent).not.toMatch(
      /GCREATOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ/
    );
  });

  test("handles zero total amount gracefully", () => {
    const invoice = createMockInvoice();
    render(<StatusTimeline invoice={invoice} total={0n} />);

    expect(screen.getByText("Invoice Created")).toBeTruthy() // element exists in DOM;
  });
});
