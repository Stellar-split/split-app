/**
 * Unit tests for PaymentSummaryCard and PaymentAggregator.
 *
 * Covers:
 *  - PaymentAggregator: progress capped at 100%
 *  - PaymentAggregator: top-payer list sorted by amount descending
 *  - PaymentAggregator: applyPayment updates all derived state
 *  - Component: skeleton shown while loading
 *  - Component: payment data rendered after initial fetch
 *  - Component: aggregator subscription wired — new poll payments are applied
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { PaymentAggregator } from "@/lib/PaymentAggregator";
import PaymentSummaryCard from "@/components/PaymentSummaryCard";

// ─── SDK mock ────────────────────────────────────────────────────────────────
jest.mock("@stellar-split/sdk", () => ({
  formatAmount: (n: bigint) => (Number(n) / 10_000_000).toFixed(2),
  truncateAddress: (addr: string) =>
    addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr,
}));

// ─── Stellar client mock ─────────────────────────────────────────────────────
const mockGetInvoice = jest.fn();
jest.mock("@/lib/stellar", () => ({
  splitClient: { getInvoice: (...args: unknown[]) => mockGetInvoice(...args) },
}));

// ─── useInterval mock — exposes a manual fire function ───────────────────────
let fireInterval: (() => void) | null = null;
jest.mock("@/hooks/useInterval", () => ({
  useInterval: (cb: () => void, delay: number | null) => {
    if (delay !== null) {
      fireInterval = cb;
    } else {
      fireInterval = null;
    }
  },
}));

// ─── Skeleton mock ───────────────────────────────────────────────────────────
jest.mock("@/components/Skeleton", () => ({
  SkeletonProgress: () => <div data-testid="skeleton-progress" />,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeInvoice = (payments: Array<{ payer: string; amount: bigint }>) => ({
  id: "inv-1",
  status: "Pending",
  creator: "CREATOR",
  recipients: [{ address: "RECIP", amount: 100_000_000n }], // 10 USDC total
  token: "USDC",
  deadline: 0,
  funded: payments.reduce((s, p) => s + p.amount, 0n),
  payments,
});

// ─── PaymentAggregator unit tests ─────────────────────────────────────────────

describe("PaymentAggregator", () => {
  test("progressPct is 0 when no payments", () => {
    const agg = new PaymentAggregator(100_000_000n);
    expect(agg.progressPct).toBe(0);
  });

  test("progressPct is capped at 100 when funded exceeds total", () => {
    const agg = new PaymentAggregator(
      10_000_000n,
      [{ payer: "A", amount: 20_000_000n }], // 200% funded
    );
    expect(agg.progressPct).toBe(100);
  });

  test("progressPct reflects partial funding", () => {
    const agg = new PaymentAggregator(
      100_000_000n,
      [{ payer: "A", amount: 50_000_000n }],
    );
    expect(agg.progressPct).toBe(50);
  });

  test("topPayers sorted by totalAmount descending", () => {
    const agg = new PaymentAggregator(100_000_000n, [
      { payer: "ADDR_C", amount: 10_000_000n },
      { payer: "ADDR_A", amount: 50_000_000n },
      { payer: "ADDR_B", amount: 30_000_000n },
    ]);
    const payers = agg.topPayers;
    expect(payers[0].address).toBe("ADDR_A");
    expect(payers[1].address).toBe("ADDR_B");
    expect(payers[2].address).toBe("ADDR_C");
  });

  test("applyPayment increases funded, paymentCount, and updates topPayers", () => {
    const agg = new PaymentAggregator(100_000_000n, [
      { payer: "A", amount: 30_000_000n },
    ]);
    expect(agg.paymentCount).toBe(1);
    expect(agg.funded).toBe(30_000_000n);

    agg.applyPayment({ payer: "B", amount: 60_000_000n });
    expect(agg.paymentCount).toBe(2);
    expect(agg.funded).toBe(90_000_000n);
    expect(agg.topPayers[0].address).toBe("B");
  });

  test("lastPaymentAt is non-null after any ingested payment", () => {
    const before = Date.now();
    const agg = new PaymentAggregator(100_000_000n, [
      { payer: "A", amount: 10_000_000n },
    ]);
    expect(agg.lastPaymentAt).not.toBeNull();
    expect(agg.lastPaymentAt!).toBeGreaterThanOrEqual(before);
  });

  test("sharePct sums match (same payer consolidation)", () => {
    const agg = new PaymentAggregator(100_000_000n, [
      { payer: "A", amount: 30_000_000n },
      { payer: "A", amount: 20_000_000n }, // same payer, should merge
    ]);
    const payers = agg.topPayers;
    expect(payers).toHaveLength(1);
    expect(payers[0].totalAmount).toBe(50_000_000n);
    expect(payers[0].paymentCount).toBe(2);
  });
});

// ─── PaymentSummaryCard component tests ──────────────────────────────────────

describe("PaymentSummaryCard", () => {
  beforeEach(() => {
    mockGetInvoice.mockReset();
    fireInterval = null;
  });

  test("shows skeleton while loading", () => {
    // Never resolves during this test
    mockGetInvoice.mockReturnValue(new Promise(() => {}));
    render(<PaymentSummaryCard invoiceId="inv-1" />);
    expect(screen.getByTestId("skeleton-progress")).toBeInTheDocument();
  });

  test("renders payment data after initial fetch", async () => {
    mockGetInvoice.mockResolvedValue(
      makeInvoice([{ payer: "GADDR_ALICE123456", amount: 50_000_000n }]),
    );
    render(<PaymentSummaryCard invoiceId="inv-1" />);
    await waitFor(() =>
      expect(screen.queryByTestId("skeleton-progress")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Payment Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/1 payment/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  test("aggregator subscription wired — new payments applied on poll", async () => {
    // First call: 1 payment
    mockGetInvoice.mockResolvedValueOnce(
      makeInvoice([{ payer: "ADDR_A", amount: 30_000_000n }]),
    );
    // Second call (triggered by interval): 2 payments (1 new)
    mockGetInvoice.mockResolvedValue(
      makeInvoice([
        { payer: "ADDR_A", amount: 30_000_000n },
        { payer: "ADDR_B", amount: 40_000_000n },
      ]),
    );

    render(<PaymentSummaryCard invoiceId="inv-1" />);

    await waitFor(() =>
      expect(screen.queryByTestId("skeleton-progress")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/1 payment/i)).toBeInTheDocument();

    // Fire the polling interval manually
    await act(async () => {
      fireInterval?.();
    });

    await waitFor(() =>
      expect(screen.getByText(/2 payments/i)).toBeInTheDocument(),
    );
    // Progress should reflect 70/100 USDC = 70%
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
  });

  test("top-payer list shows highest payer first", async () => {
    mockGetInvoice.mockResolvedValue(
      makeInvoice([
        { payer: "GCHEAP111111", amount: 10_000_000n },
        { payer: "GBIGSPENDER11", amount: 80_000_000n },
      ]),
    );
    render(<PaymentSummaryCard invoiceId="inv-1" />);
    await waitFor(() =>
      expect(screen.queryByTestId("skeleton-progress")).not.toBeInTheDocument(),
    );
    const listItems = screen.getAllByRole("listitem");
    // First list item should contain the big spender's truncated address
    expect(listItems[0].textContent).toContain("GBIGSP");
  });

  test("polling stops when invoice is Released", async () => {
    const releasedInvoice = {
      ...makeInvoice([{ payer: "A", amount: 100_000_000n }]),
      status: "Released",
    };
    mockGetInvoice.mockResolvedValue(releasedInvoice);
    render(<PaymentSummaryCard invoiceId="inv-1" />);
    await waitFor(() =>
      expect(screen.queryByTestId("skeleton-progress")).not.toBeInTheDocument(),
    );
    // After a Released invoice, fireInterval should be cleared (delay=null)
    await act(async () => {
      fireInterval?.();
    });
    expect(fireInterval).toBeNull();
  });
});
