import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import SubscriptionCard from "@/components/SubscriptionCard";
import type { Subscription } from "@/types/subscription";

vi.mock("@stellar-split/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar-split/sdk")>();
  return {
    ...actual,
    formatAmount: (n: bigint) => `${n / 1000000n}`,
    truncateAddress: (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`,
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockSubscription: Subscription = {
  id: "sub-1",
  templateName: "Monthly Hosting",
  creator: "GCREADER1234567890ABCDEF",
  recipients: [
    { address: "GDEST1234567890ABCDEF", amount: 50000000n },
  ],
  frequency: "monthly",
  intervalDays: 30,
  status: "active",
  createdAt: Math.floor(Date.now() / 1000) - 86400 * 30,
  nextRunDate: Math.floor(Date.now() / 1000) + 86400 * 5,
  lastRunDate: Math.floor(Date.now() / 1000) - 86400 * 25,
  token: "USDC",
  totalInvoicesGenerated: 3,
  totalUsdcCollected: 150000000n,
  invoiceHistory: [
    {
      invoiceId: "101",
      generatedAt: Math.floor(Date.now() / 1000) - 86400 * 30,
      deadline: Math.floor(Date.now() / 1000) - 86400 * 25,
      amount: 50000000n,
      status: "Released",
    },
  ],
};

describe("SubscriptionCard", () => {
  it("renders template name", () => {
    render(<SubscriptionCard subscription={mockSubscription} />);
    expect(screen.getByText("Monthly Hosting")).toBeInTheDocument();
  });

  it("renders status", () => {
    render(<SubscriptionCard subscription={mockSubscription} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders frequency", () => {
    render(<SubscriptionCard subscription={mockSubscription} />);
    expect(screen.getByText("Monthly")).toBeInTheDocument();
  });

  it("renders total invoices", () => {
    render(<SubscriptionCard subscription={mockSubscription} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders USDC collected", () => {
    render(<SubscriptionCard subscription={mockSubscription} />);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("renders paused status", () => {
    const paused = { ...mockSubscription, status: "paused" as const };
    render(<SubscriptionCard subscription={paused} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("renders cancelled status", () => {
    const cancelled = { ...mockSubscription, status: "cancelled" as const };
    render(<SubscriptionCard subscription={cancelled} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("links to detail page", () => {
    render(<SubscriptionCard subscription={mockSubscription} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/subscriptions/sub-1");
  });

  it("shows dash for next run when paused", () => {
    const paused = { ...mockSubscription, status: "paused" as const };
    render(<SubscriptionCard subscription={paused} />);
    // The next run date should show a dash for paused subscriptions
    const nextRunSection = screen.getByText("Next Run");
    expect(nextRunSection.parentElement?.textContent).toContain("—");
  });
});
