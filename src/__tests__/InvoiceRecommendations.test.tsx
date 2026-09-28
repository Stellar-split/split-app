import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import InvoiceRecommendations from "@/components/recommendations/InvoiceRecommendations";
import { recommendInvoices, type PastInvoice } from "@/lib/invoiceRecommendations";

const DAY = 86_400_000;
const history: PastInvoice[] = [
  { id: "1", title: "Rent", amount: 900, recipients: ["GA", "GB"], createdAt: 0 },
  { id: "2", title: "rent ", amount: 900, recipients: ["GA", "GB"], createdAt: 30 * DAY },
  { id: "3", title: "Dinner", amount: 60, recipients: ["GA"], createdAt: 40 * DAY },
];

describe("recommendInvoices", () => {
  it("returns nothing for empty history", () => {
    expect(recommendInvoices([])).toEqual([]);
  });

  it("suggests frequent recipients, typical amount and recurring invoices", () => {
    const recs = recommendInvoices(history);
    expect(recs[0]).toMatchObject({ type: "recipient", value: "GA", score: 1 });
    expect(recs.find((r) => r.type === "amount")?.value).toBe("900.00");
    expect(recs.find((r) => r.type === "recurring")?.label).toBe("Recurring every ~30 days");
    expect(recommendInvoices(history, 2)).toHaveLength(2);
  });
});

describe("InvoiceRecommendations", () => {
  it("renders recommendations and applies one", () => {
    const onApply = vi.fn();
    render(<InvoiceRecommendations history={history} onApply={onApply} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Use" })[0]);
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ value: "GA" }));
  });

  it("shows empty state", () => {
    render(<InvoiceRecommendations history={[]} />);
    expect(screen.getByText(/Create a few invoices/)).toBeInTheDocument();
  });
});
