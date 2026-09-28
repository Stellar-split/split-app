import { render, screen, fireEvent } from "@testing-library/react";
import RateCardBuilder from "@/components/RateCardBuilder";
import RecipientEarningsPanel from "@/components/analytics/RecipientEarningsPanel";

describe("RateCardBuilder", () => {
  it("updates the total as rates change and adds rows", () => {
    render(<RateCardBuilder />);
    fireEvent.change(screen.getByLabelText("Rate"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "4" } });
    expect(screen.getByText("Total: 100.00")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Add service"));
    expect(screen.getAllByLabelText("Service")).toHaveLength(2);
  });
});

describe("RecipientEarningsPanel", () => {
  it("filters earnings by asset", () => {
    render(
      <RecipientEarningsPanel
        records={[
          { invoiceId: "a", amount: 10, asset: "XLM", paidAt: "2026-01-05T00:00:00Z" },
          { invoiceId: "b", amount: 30, asset: "USDC", paidAt: "2026-02-05T00:00:00Z" },
        ]}
      />,
    );
    expect(screen.getByText("40.00")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Asset"), { target: { value: "USDC" } });
    expect(screen.getAllByText("30.00").length).toBeGreaterThan(0);
  });
});
