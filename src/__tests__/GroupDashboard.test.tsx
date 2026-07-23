/**
 * Unit tests for the group dashboard aggregate view at
 * src/app/groups/[id]/page.tsx.
 *
 * Covers:
 *  - Aggregate totalFunded / totalRequired across mixed invoices
 *  - Per-invoice percent funded calculation
 *  - Empty state when group has no invoices
 *  - Loading state
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import GroupDetailPage from "@/app/groups/[id]/page";

// ─── Next navigation mock ───────────────────────────────────────────────────
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-group-1" }),
}));

// ─── SDK mock ────────────────────────────────────────────────────────────────
jest.mock("@stellar-split/sdk", () => ({
  formatAmount: (n: bigint) => (Number(n) / 10_000_000).toFixed(2),
}));

// ─── Freighter mock ─────────────────────────────────────────────────────────
const mockGetPublicKey = jest.fn();
jest.mock("@/lib/freighter", () => ({
  getFreighterPublicKey: (...args: unknown[]) => mockGetPublicKey(...args),
}));

// ─── Stellar client mock ─────────────────────────────────────────────────────
const mockGetGroupStatus = jest.fn();
jest.mock("@/lib/stellar", () => ({
  splitClient: {
    getGroupStatus: (...args: unknown[]) => mockGetGroupStatus(...args),
  },
}));

// ─── Skeleton mock ───────────────────────────────────────────────────────────
jest.mock("@/components/Skeleton", () => ({
  SkeletonCard: () => <div data-testid="skeleton-card" />,
  SkeletonRow: () => <div data-testid="skeleton-row" />,
}));

// ─── PaymentProgress mock ────────────────────────────────────────────────────
jest.mock("@/components/PaymentProgress", () => ({
  __esModule: true,
  default: ({ funded, total }: { funded: bigint; total: bigint }) => {
    const pct = total > 0n ? Number((funded * 100n) / total) : 0;
    return (
      <div data-testid="payment-progress">
        <div role="progressbar" aria-valuenow={Math.min(100, pct)} />
      </div>
    );
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInvoice(
  id: string,
  funded: bigint,
  recipientAmounts: bigint[],
  status = "Pending",
) {
  return {
    id,
    creator: "CREATOR",
    recipients: recipientAmounts.map((amount) => ({
      address: "RECIP",
      amount,
    })),
    token: "USDC",
    deadline: 0,
    funded,
    status,
    payments: [],
  };
}

function makeGroupStatus(memberInvoices: ReturnType<typeof makeInvoice>[]) {
  const totalFunded = memberInvoices.reduce(
    (s: number, inv: { funded: bigint }) => s + Number(inv.funded),
    0,
  );
  const totalRequired = memberInvoices.reduce(
    (s: number, inv: { recipients: Array<{ amount: bigint }> }) =>
      s +
      inv.recipients.reduce(
        (s2: number, r: { amount: bigint }) => s2 + Number(r.amount),
        0,
      ),
    0,
  );
  return {
    id: "test-group-1",
    memberInvoices,
    totalFunded: BigInt(totalFunded),
    totalRequired: BigInt(totalRequired),
    allFunded: totalFunded >= totalRequired,
  };
}

// ─── Group detail page tests ──────────────────────────────────────────────────

describe("GroupDashboard aggregate calculation", () => {
  beforeEach(() => {
    mockGetPublicKey.mockReset();
    mockGetGroupStatus.mockReset();
    mockGetPublicKey.mockResolvedValue("GPUBLIC_KEY");
  });

  test("shows loading skeleton initially", () => {
    mockGetGroupStatus.mockReturnValue(new Promise(() => {}));
    render(<GroupDetailPage />);
    expect(screen.getByTestId("skeleton-card")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton-row")).toHaveLength(3);
  });

  test("shows empty state when group has no invoices", async () => {
    mockGetGroupStatus.mockResolvedValue(makeGroupStatus([]));
    render(<GroupDetailPage />);
    await waitFor(() =>
      expect(screen.getByText(/no invoices yet/i)).toBeInTheDocument(),
    );
  });

  test("aggregates totalFunded and totalRequired across mixed invoices", async () => {
    mockGetGroupStatus.mockResolvedValue(
      makeGroupStatus([
        makeInvoice("1", 50_000_000n, [100_000_000n]), // 50% funded
        makeInvoice("2", 100_000_000n, [100_000_000n]), // 100% funded
        makeInvoice("3", 0n, [200_000_000n]), // 0% funded
      ]),
    );

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.queryByTestId("skeleton-card")).not.toBeInTheDocument();
    });

    // Aggregate: 150_000_000 / 400_000_000 stroops = 15.00 / 40.00 USDC = 37.5%
    expect(screen.getByText(/15\.00 \/ 40\.00 USDC/)).toBeInTheDocument();

    // progressbar should have aria-valuenow = 37
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "37");

    // Each invoice should be listed in the table
    expect(screen.getByText("Invoice #1")).toBeInTheDocument();
    expect(screen.getByText("Invoice #2")).toBeInTheDocument();
    expect(screen.getByText("Invoice #3")).toBeInTheDocument();
  });

  test("per-invoice percent shown in breakdown table", async () => {
    mockGetGroupStatus.mockResolvedValue(
      makeGroupStatus([
        makeInvoice("1", 25_000_000n, [100_000_000n]), // 25%
        makeInvoice("2", 75_000_000n, [100_000_000n]), // 75%
        makeInvoice("3", 100_000_000n, [100_000_000n]), // 100%
      ]),
    );

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.queryByTestId("skeleton-card")).not.toBeInTheDocument();
    });

    // 25%, 75%, 100% text should appear
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  test("handles fully funded and partially funded mixed correctly", async () => {
    mockGetGroupStatus.mockResolvedValue(
      makeGroupStatus([
        makeInvoice("1", 200_000_000n, [100_000_000n]), // 200% funded (capped)
        makeInvoice("2", 30_000_000n, [100_000_000n]), // 30% funded
        makeInvoice("3", 0n, [100_000_000n]), // 0% funded
      ]),
    );

    render(<GroupDetailPage />);

    await waitFor(() => {
      expect(screen.queryByTestId("skeleton-card")).not.toBeInTheDocument();
    });

    // Aggregate totalFunded = 230, totalRequired = 300
    // progressbar = 76% (230/300 * 100 = 76.66, truncated to 76 by integer division)
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "76");
  });

  test("shows error when wallet not connected", async () => {
    mockGetPublicKey.mockRejectedValue(new Error("No wallet"));
    render(<GroupDetailPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/Connect your Freighter wallet/i),
      ).toBeInTheDocument(),
    );
  });
});
