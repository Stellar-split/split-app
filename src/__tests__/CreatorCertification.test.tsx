import React from "react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
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
    expect(screen.getByText("Not certified")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText("Requirements for bronze certification")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/Verify your wallet/)).toBeTruthy() // element exists in DOM;
    expect(screen.getByRole("progressbar")).to.have.property('getAttribute', "aria-valuenow", "33");
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
    expect(screen.getByText("gold")).toBeTruthy() // element exists in DOM;
    expect(screen.getByText("Top certification reached")).toBeTruthy() // element exists in DOM;
    expect(screen.getByRole("progressbar")).to.have.property('getAttribute', "aria-valuenow", "100");
  });
});
