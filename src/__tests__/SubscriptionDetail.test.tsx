import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import SubscriptionDetailClient from "@/components/SubscriptionDetailClient";
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

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "sub-1" }),
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockSubscription: Subscription = {
  id: "sub-1",
  templateName: "Weekly Design Retainer",
  creator: "GCREADER1234567890ABCDEF",
  recipients: [
    { address: "GDEST1234567890ABCDEF", amount: 100000000n },
  ],
  frequency: "weekly",
  intervalDays: 7,
  status: "active",
  createdAt: Math.floor(Date.now() / 1000) - 86400 * 14,
  nextRunDate: Math.floor(Date.now() / 1000) + 86400 * 3,
  lastRunDate: Math.floor(Date.now() / 1000) - 86400 * 4,
  token: "USDC",
  totalInvoicesGenerated: 2,
  totalUsdcCollected: 200000000n,
  invoiceHistory: [
    {
      invoiceId: "201",
      generatedAt: Math.floor(Date.now() / 1000) - 86400 * 14,
      deadline: Math.floor(Date.now() / 1000) - 86400 * 10,
      amount: 100000000n,
      status: "Released",
    },
    {
      invoiceId: "202",
      generatedAt: Math.floor(Date.now() / 1000) - 86400 * 7,
      deadline: Math.floor(Date.now() / 1000) - 86400 * 3,
      amount: 100000000n,
      status: "Pending",
    },
  ],
};

describe("SubscriptionDetailClient", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      "stellar_split_subscriptions",
      JSON.stringify([
        {
          ...mockSubscription,
          recipients: mockSubscription.recipients.map((r) => ({
            ...r,
            amount: r.amount.toString(),
          })),
          totalUsdcCollected: mockSubscription.totalUsdcCollected.toString(),
          invoiceHistory: mockSubscription.invoiceHistory.map((inv) => ({
            ...inv,
            amount: inv.amount.toString(),
          })),
        },
      ])
    );
  });

  it("renders subscription template name", async () => {
    render(<SubscriptionDetailClient />);
    const els = await screen.findAllByText("Weekly Design Retainer");
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  it("renders subscription status", async () => {
    render(<SubscriptionDetailClient />);
    expect(await screen.findByText("Active")).toBeInTheDocument();
  });

  it("renders frequency", async () => {
    render(<SubscriptionDetailClient />);
    expect(await screen.findByText("Weekly")).toBeInTheDocument();
  });

  it("renders pause button for active subscription", async () => {
    render(<SubscriptionDetailClient />);
    expect(await screen.findByText("Pause Subscription")).toBeInTheDocument();
  });

  it("renders cancel button", async () => {
    render(<SubscriptionDetailClient />);
    expect(await screen.findByText("Cancel Subscription")).toBeInTheDocument();
  });

  it("renders invoice history table", async () => {
    render(<SubscriptionDetailClient />);
    expect(await screen.findByText(/Invoice History/)).toBeInTheDocument();
  });

  it("renders recipients section", async () => {
    render(<SubscriptionDetailClient />);
    expect(await screen.findByText("Recipients")).toBeInTheDocument();
  });

  it("renders calendar preview for active subscription", async () => {
    render(<SubscriptionDetailClient />);
    expect(await screen.findByText("Upcoming Invoice Dates")).toBeInTheDocument();
  });

  it("renders total invoices count", async () => {
    render(<SubscriptionDetailClient />);
    expect(await screen.findByText("Total Invoices")).toBeInTheDocument();
  });

  it("renders back link", async () => {
    render(<SubscriptionDetailClient />);
    const backLink = await screen.findByText("← Subscriptions");
    expect(backLink).toHaveAttribute("href", "/subscriptions");
  });
});
