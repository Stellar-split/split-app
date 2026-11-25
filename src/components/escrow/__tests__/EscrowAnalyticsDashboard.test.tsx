import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EscrowAnalyticsDashboard from "../EscrowAnalyticsDashboard";
import type { EscrowContract } from "@/types/escrow";

const mockEscrows: EscrowContract[] = [
  {
    id: "e1",
    depositor: "alice",
    beneficiary: "bob",
    recipients: [{ address: "bob", amount: 1000n }],
    token: "USDC",
    targetAmount: 1000n,
    fundedAmount: 1000n,
    status: "Released",
    releaseTriggerType: "AUTOMATIC",
    conditionLogic: "ALL",
    conditions: [
      { id: "c1", type: "TIME_LOCK", title: "Time Lock", releaseTimestamp: 100, met: true },
    ],
    disputeHold: false,
    history: [],
    createdAt: 1000,
    updatedAt: 1060,
  },
  {
    id: "e2",
    depositor: "alice",
    beneficiary: "carol",
    recipients: [{ address: "carol", amount: 2000n }],
    token: "USDC",
    targetAmount: 2000n,
    fundedAmount: 2000n,
    status: "Disputed",
    releaseTriggerType: "AUTOMATIC",
    conditionLogic: "ALL",
    conditions: [
      { id: "c2", type: "MILESTONE", title: "Milestone", milestoneId: "m1", completed: false, met: false },
    ],
    disputeHold: true,
    dispute: {
      id: "d1",
      initiator: "alice",
      reason: "Delayed delivery",
      status: "Open",
      createdAt: 1010,
    },
    history: [],
    createdAt: 1000,
    updatedAt: 1010,
  },
];

describe("EscrowAnalyticsDashboard Component", () => {
  it("renders metric cards, TVL, and status distribution", () => {
    render(<EscrowAnalyticsDashboard escrows={mockEscrows} />);

    expect(screen.getByTestId("escrow-analytics-dashboard")).toBeInTheDocument();
    expect(screen.getByText("Escrow Analytics & Reporting")).toBeInTheDocument();
    expect(screen.getByText("Total Value Locked (TVL)")).toBeInTheDocument();
    expect(screen.getByText("Released Funds")).toBeInTheDocument();
    expect(screen.getByText("Dispute Rate")).toBeInTheDocument();
    expect(screen.getByText("Status Distribution")).toBeInTheDocument();
    expect(screen.getByText("Condition Evaluation Pass Rates")).toBeInTheDocument();
  });

  it("filters by status using dropdown", () => {
    render(<EscrowAnalyticsDashboard escrows={mockEscrows} />);

    const select = screen.getByLabelText("Filter escrows by status");
    fireEvent.change(select, { target: { value: "Released" } });

    expect(select).toHaveValue("Released");
  });

  it("handles export report button click", () => {
    render(<EscrowAnalyticsDashboard escrows={mockEscrows} />);

    const exportBtn = screen.getByText("Export Report");
    expect(exportBtn).toBeInTheDocument();
    fireEvent.click(exportBtn);
  });
});
