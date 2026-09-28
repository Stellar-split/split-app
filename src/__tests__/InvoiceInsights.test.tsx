import React from "react";
import { render, screen } from "@testing-library/react";
import type { Invoice } from "@stellar-split/sdk";
import InvoiceSentiment, { analyzeInvoiceSentiment } from "@/components/invoice/InvoiceSentiment";
import AdvancedStatusTimeline, { buildStatusStages } from "@/components/invoice/AdvancedStatusTimeline";
import PayerWalletHealth, { computePayerHealth } from "@/components/invoice/PayerWalletHealth";
import ReconciliationPanel, { reconcileInvoice } from "@/components/invoice/ReconciliationPanel";

const NOW = 1_700_000_000;
const A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const C = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "1",
    creator: A,
    recipients: [{ address: B, amount: 100n }],
    token: "USDC",
    deadline: NOW + 7 * 86_400,
    funded: 0n,
    status: "Pending",
    payments: [],
    ...overrides,
  };
}

describe("analyzeInvoiceSentiment", () => {
  it("is positive when released", () => {
    expect(analyzeInvoiceSentiment(makeInvoice({ status: "Released" }), NOW).label).toBe("positive");
  });
  it("is negative when refunded", () => {
    expect(analyzeInvoiceSentiment(makeInvoice({ status: "Refunded" }), NOW).label).toBe("negative");
  });
  it("is negative with no payments past the deadline", () => {
    expect(analyzeInvoiceSentiment(makeInvoice({ deadline: NOW - 1 }), NOW).label).toBe("negative");
  });
  it("is positive when well funded by many payers", () => {
    const payments = [A, B, C].map((payer) => ({ payer, amount: 30n }));
    expect(analyzeInvoiceSentiment(makeInvoice({ funded: 90n, payments }), NOW).label).toBe("positive");
  });
  it("renders the label", () => {
    render(<InvoiceSentiment invoice={makeInvoice({ status: "Released" })} />);
    expect(screen.getByTestId("sentiment-label")).toHaveTextContent("Positive");
  });
});

describe("buildStatusStages", () => {
  it("marks funding as current for a new invoice", () => {
    const stages = buildStatusStages(makeInvoice(), NOW);
    expect(stages.map((s) => s.state)).toEqual(["complete", "current", "upcoming", "upcoming"]);
  });
  it("marks release as current once fully funded", () => {
    const stages = buildStatusStages(makeInvoice({ funded: 100n, payments: [{ payer: A, amount: 100n }] }), NOW);
    expect(stages[3]).toMatchObject({ key: "released", state: "current" });
  });
  it("ends in refunded for refunded invoices", () => {
    const stages = buildStatusStages(makeInvoice({ status: "Refunded" }), NOW);
    expect(stages[stages.length - 1]).toMatchObject({ key: "refunded", state: "complete" });
    expect(stages[1].state).toBe("skipped");
  });
  it("renders every stage", () => {
    render(<AdvancedStatusTimeline invoice={makeInvoice()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});

describe("computePayerHealth", () => {
  it("aggregates and sorts by total, flagging concentration", () => {
    const rows = computePayerHealth([
      { payer: A, amount: 70n },
      { payer: B, amount: 20n },
      { payer: A, amount: 5n },
      { payer: C, amount: 5n },
    ]);
    expect(rows.map((r) => r.payer)).toEqual([A, B, C]);
    expect(rows[0]).toMatchObject({ total: 75n, count: 2, share: 75, health: "concentrated" });
    expect(rows[1].health).toBe("healthy");
  });
  it("does not flag a sole payer", () => {
    expect(computePayerHealth([{ payer: A, amount: 10n }])[0].health).toBe("healthy");
  });
  it("renders an empty state", () => {
    render(<PayerWalletHealth payments={[]} />);
    expect(screen.getByText("No payer wallets yet.")).toBeInTheDocument();
  });
});

describe("reconcileInvoice", () => {
  it("is balanced when funded matches payments", () => {
    const r = reconcileInvoice(makeInvoice({ funded: 40n, payments: [{ payer: A, amount: 40n }] }));
    expect(r).toMatchObject({ balanced: true, outstanding: 60n, ledgerDiscrepancy: 0n });
  });
  it("reports ledger discrepancies and overpayment", () => {
    const r = reconcileInvoice(makeInvoice({ funded: 120n, payments: [{ payer: A, amount: 100n }] }));
    expect(r.balanced).toBe(false);
    expect(r.ledgerDiscrepancy).toBe(20n);
    expect(r.overpaid).toBe(20n);
    expect(r.issues).toHaveLength(2);
  });
  it("renders issue count", () => {
    render(<ReconciliationPanel invoice={makeInvoice({ funded: 10n })} />);
    expect(screen.getByTestId("reconciliation-status")).toHaveTextContent("1 issue");
  });
});
