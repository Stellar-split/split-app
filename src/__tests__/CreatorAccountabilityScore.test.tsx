import React from "react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen } from "@testing-library/react";
import CreatorAccountabilityScore from "@/components/creator/CreatorAccountabilityScore";

describe("CreatorAccountabilityScore", () => {
  it("renders the score, grade and breakdown", () => {
    render(
      <CreatorAccountabilityScore
        stats={{
          totalInvoices: 20,
          fulfilledInvoices: 20,
          cancelledInvoices: 0,
          disputes: 0,
          disputesLost: 0,
          avgResponseHours: 2,
        }}
      />,
    );
    expect(screen.getByLabelText("Grade A")).toBeTruthy() // element exists in DOM;
    expect(screen.getByRole("meter")).to.have.property('getAttribute', "aria-valuenow", "100");
    expect(screen.getByText("50 / 50")).toBeTruthy() // element exists in DOM;
  });

  it("explains when there is not enough history", () => {
    render(
      <CreatorAccountabilityScore
        stats={{
          totalInvoices: 1,
          fulfilledInvoices: 1,
          cancelledInvoices: 0,
          disputes: 0,
          disputesLost: 0,
          avgResponseHours: 2,
        }}
      />,
    );
    expect(screen.getByText(/Not enough invoice history/)).toBeTruthy() // element exists in DOM;
    expect(screen.queryByRole("meter")).toBeNull();
  });
});
