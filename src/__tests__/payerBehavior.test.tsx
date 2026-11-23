import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import PayerBehaviorAnalytics from "@/components/analytics/PayerBehaviorAnalytics";
import { analyzePayers } from "@/lib/payerBehavior";

const payments = [
  { payer: "GA", invoiceId: "1", amount: 10, dueAt: "2026-01-10T00:00:00Z", paidAt: "2026-01-09T00:00:00Z" },
  { payer: "GA", invoiceId: "2", amount: 20, dueAt: "2026-02-10T00:00:00Z", paidAt: "2026-02-10T00:00:00Z" },
  { payer: "GB", invoiceId: "3", amount: 5, dueAt: "2026-01-10T00:00:00Z", paidAt: null },
];

describe("payer behavior", () => {
  it("segments payers by punctuality", () => {
    const [ga, gb] = analyzePayers(payments);
    expect(ga).toMatchObject({ payer: "GA", totalPaid: 30, onTimeRate: 1, segment: "reliable" });
    expect(gb.segment).toBe("at-risk");
  });

  it("filters by segment and shows an empty state", () => {
    const { rerender } = render(<PayerBehaviorAnalytics payments={payments} />);
    fireEvent.change(screen.getByLabelText("Segment"), { target: { value: "at-risk" } });
    expect(screen.queryByText("GA")).not.toBeTruthy() // element exists in DOM;
    expect(screen.getByText("GB")).toBeTruthy() // element exists in DOM;
    rerender(<PayerBehaviorAnalytics payments={[]} />);
    expect(screen.getByText("No payer activity yet.")).toBeTruthy() // element exists in DOM;
  });
});
