import React from "react";
import { describe, it, test, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen } from "@testing-library/react";
import PortfolioOptimization from "@/components/recommendations/PortfolioOptimization";

const DAY = 86_400_000;
const NOW = 100 * DAY;

describe("PortfolioOptimization", () => {
  it("renders recommendations for an at-risk portfolio", () => {
    render(
      <PortfolioOptimization
        now={NOW}
        invoices={[
          { id: "a", title: "Late", amount: 100, status: "open", recipients: ["GA"], createdAt: NOW - 5 * DAY, dueAt: NOW - DAY },
        ]}
      />,
    );
    expect(screen.getByRole("list", { name: "Portfolio optimization recommendations" })).toBeTruthy() // element exists in DOM;
    expect(screen.getByText(/1 open invoice past due/)).toBeTruthy() // element exists in DOM;
  });

  it("shows a healthy state when there is nothing to recommend", () => {
    render(<PortfolioOptimization invoices={[]} now={NOW} />);
    expect(screen.getByText(/looks healthy/)).toBeTruthy() // element exists in DOM;
  });
});
