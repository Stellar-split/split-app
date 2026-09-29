import React from "react";
import { render, screen } from "@testing-library/react";
import SocialProofWidget from "@/components/pay/SocialProofWidget";

const MIN = 60_000;
const NOW = 1_000_000_000;
const ADDR = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("SocialProofWidget", () => {
  it("shows recent payments with masked payer addresses", () => {
    render(
      <SocialProofWidget
        now={NOW}
        payments={[{ id: "1", payer: ADDR, amount: 25, asset: "XLM", paidAt: NOW - 5 * MIN }]}
      />,
    );
    expect(screen.getByText("1 person paid in the last 24 hours")).toBeInTheDocument();
    expect(screen.getByText("5m ago")).toBeInTheDocument();
    expect(screen.getByText(/paid 25 XLM/)).toBeInTheDocument();
    expect(screen.queryByText(ADDR)).toBeNull();
  });

  it("renders nothing when there are no payments", () => {
    const { container } = render(<SocialProofWidget payments={[]} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });
});
