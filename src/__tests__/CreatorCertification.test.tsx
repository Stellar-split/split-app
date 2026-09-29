import React from "react";
import { render, screen } from "@testing-library/react";
import CreatorCertification from "@/components/creator/CreatorCertification";

const base = {
  walletVerified: false,
  kycVerified: false,
  accountAgeDays: 0,
  completedInvoices: 0,
  disputeRate: 0,
  onTimeRate: 0,
};

describe("CreatorCertification", () => {
  it("shows the uncertified state and bronze requirements", () => {
    render(<CreatorCertification profile={base} />);
    expect(screen.getByText("Not certified")).toBeInTheDocument();
    expect(screen.getByText("Requirements for bronze certification")).toBeInTheDocument();
    expect(screen.getByText(/Verify your wallet/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  });

  it("shows the top tier when gold is reached", () => {
    render(
      <CreatorCertification
        profile={{
          walletVerified: true,
          kycVerified: true,
          accountAgeDays: 400,
          completedInvoices: 60,
          disputeRate: 0.01,
          onTimeRate: 0.95,
        }}
      />,
    );
    expect(screen.getByText("gold")).toBeInTheDocument();
    expect(screen.getByText("Top certification reached")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
