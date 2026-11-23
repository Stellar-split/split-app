import { describe, expect, it } from "vitest";
import {
  createApprovalRequest,
  recordApprovalDecision,
  shouldRequireApproval,
  summarizeApprovalAnalytics,
  type ApprovalPolicy,
} from "./invoiceApprovals";

const policy: ApprovalPolicy = {
  enabled: true,
  minimumAmount: 500,
  levels: [["GAPPROVER1"], ["GAPPROVER2"]],
};

describe("invoice approval workflow", () => {
  it("routes only amounts meeting the configured condition", () => {
    expect(shouldRequireApproval(499.99, policy)).toBe(false);
    expect(shouldRequireApproval(500, policy)).toBe(true);
    expect(shouldRequireApproval(900, { ...policy, enabled: false })).toBe(false);
  });

  it("requires approvals in order and records each decision", () => {
    const request = createApprovalRequest(
      {
        owner: "GOWNER",
        title: "Quarterly services",
        amount: 750,
        payload: { recipients: [], token: "USDC", deadline: 0 },
      },
      policy,
      1000,
    );
    const firstLevel = recordApprovalDecision(request, "GAPPROVER1", "approved", "Checked", 2000);

    expect(firstLevel.status).toBe("pending");
    expect(firstLevel.currentLevel).toBe(1);
    expect(firstLevel.events[firstLevel.events.length - 1]?.comment).toBe("Checked");
    expect(() => recordApprovalDecision(firstLevel, "GAPPROVER1", "approved")).toThrow(
      "not assigned",
    );
    expect(() => recordApprovalDecision(request, "GOWNER", "approved")).toThrow(
      "cannot approve their own",
    );

    const final = recordApprovalDecision(firstLevel, "GAPPROVER2", "approved", "", 3000);
    expect(final.status).toBe("approved");
  });

  it("calculates approval analytics from completed decisions", () => {
    const request = createApprovalRequest(
      {
        owner: "GOWNER",
        title: "Services",
        amount: 600,
        payload: { recipients: [], token: "USDC", deadline: 0 },
      },
      policy,
      1_000,
    );
    const rejected = recordApprovalDecision(request, "GAPPROVER1", "rejected", "Needs revision", 3_601_000);
    const analytics = summarizeApprovalAnalytics([rejected]);

    expect(analytics.rejected).toBe(1);
    expect(analytics.approvalRate).toBe(0);
    expect(analytics.averageDecisionHours).toBe(1);
  });
});