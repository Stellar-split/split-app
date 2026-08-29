import React from "react";
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
    expect(desktopSection).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
  });

  test("renders mobile stepper on mobile screens", () => {
    const invoice = createMockInvoice();
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    const mobileSection = container.querySelector(".sm\\:hidden");
    expect(mobileSection).toBeInTheDocument();
  });

  test("shows Created event with creator info", () => {
    const invoice = createMockInvoice();
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Invoice Created")).toBeInTheDocument();
    expect(screen.getByText(/GCREA/)).toBeInTheDocument();
  });

  test("displays First Payment event when invoice has funded amount", () => {
    const invoice = createMockInvoice({ funded: 50_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("First Payment")).toBeInTheDocument();
  });

  test("does not show First Payment event when no payments", () => {
    const invoice = createMockInvoice({ funded: 0n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.queryByText("First Payment")).not.toBeInTheDocument();
  });

  test("displays Milestone event at 50% funding", () => {
    const invoice = createMockInvoice({ funded: 50_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText(/Milestone Reached \(50%\)/)).toBeInTheDocument();
  });

  test("shows Fully Funded event when total reached", () => {
    const invoice = createMockInvoice({ funded: 100_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Fully Funded")).toBeInTheDocument();
  });

  test("displays Funds Released event when status is Released", () => {
    const invoice = createMockInvoice({ status: "Released" });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Funds Released")).toBeInTheDocument();
  });

  test("shows expired event when deadline passed", () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 3600;
    const invoice = createMockInvoice({ deadline: pastDeadline });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Invoice Expired")).toBeInTheDocument();
  });

  test("timeline events have icons as visual indicators", () => {
    const invoice = createMockInvoice({ funded: 100_000_000n });
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    const timelineList = container.querySelector("[aria-label*='timeline']");
    expect(timelineList).toBeInTheDocument();

    const iconSpans = container.querySelectorAll("span[aria-hidden='true']");
    expect(iconSpans.length).toBeGreaterThan(0);
  });

  test("mobile stepper shows correct active step when no funding", () => {
    const invoice = createMockInvoice({ funded: 0n });
    const { container } = render(
      <StatusTimeline invoice={invoice} total={100_000_000n} />
    );

    const steps = container.querySelectorAll(".sm\\:hidden .flex-1");
    expect(steps[0]).toHaveClass("text-white", "font-semibold");
  });

  test("mobile stepper shows partially funded state", () => {
    const invoice = createMockInvoice({ funded: 50_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Partially Funded")).toBeInTheDocument();
  });

  test("mobile stepper shows released state", () => {
    const invoice = createMockInvoice({ status: "Released" });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("Released")).toBeInTheDocument();
  });

  test("timeline displays no events message when empty", () => {
    const invoice = createMockInvoice({
      funded: 0n,
      status: "Pending",
      deadline: Math.floor(Date.now() / 1000) + 86400,
    });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    expect(screen.getByText("No events yet.")).toBeInTheDocument();
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
    expect(lastDot).toHaveClass("bg-indigo-600", "border-indigo-500");
  });

  test("event labels are text-sm and readable", () => {
    const invoice = createMockInvoice({ funded: 100_000_000n });
    render(<StatusTimeline invoice={invoice} total={100_000_000n} />);

    const labels = screen.getAllByText(/Fully Funded|Invoice Created/);
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect(label.closest(".text-sm")).toBeInTheDocument();
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

    expect(screen.getByText("Invoice Created")).toBeInTheDocument();
  });
});
