import { describe, expect, it } from "vitest";
import {
  evaluateApproval,
  evaluateConditions,
  evaluateCustom,
  evaluateMilestone,
  evaluateOracle,
  evaluateSingleCondition,
  evaluateThreshold,
  evaluateTimeLock,
} from "../conditionEngine";
import type {
  ApprovalCondition,
  CustomCondition,
  MilestoneCondition,
  OracleCondition,
  ThresholdCondition,
  TimeLockCondition,
} from "@/types/escrow";

describe("Condition Evaluation Engine", () => {
  describe("TimeLockCondition", () => {
    it("returns met=true when currentTimestamp >= releaseTimestamp", () => {
      const cond: TimeLockCondition = {
        id: "c_time_1",
        type: "TIME_LOCK",
        title: "7-day lock",
        releaseTimestamp: 1000,
        met: false,
      };
      const res = evaluateTimeLock(cond, 1000);
      expect(res.met).toBe(true);
      expect(res.reason).toBeUndefined();

      const futureRes = evaluateTimeLock(cond, 1050);
      expect(futureRes.met).toBe(true);
    });

    it("returns met=false with remaining duration when timestamp is before unlock", () => {
      const cond: TimeLockCondition = {
        id: "c_time_2",
        type: "TIME_LOCK",
        title: "Lock",
        releaseTimestamp: 2000,
        met: false,
      };
      const res = evaluateTimeLock(cond, 1500);
      expect(res.met).toBe(false);
      expect(res.reason).toContain("500s remaining");
    });
  });

  describe("MilestoneCondition", () => {
    it("evaluates milestone status and respects context overrides", () => {
      const cond: MilestoneCondition = {
        id: "c_mile_1",
        type: "MILESTONE",
        title: "Phase 1 Delivery",
        milestoneId: "m_1",
        completed: false,
        met: false,
      };

      expect(evaluateMilestone(cond).met).toBe(false);

      const withContext = evaluateMilestone(cond, {
        milestoneCompletions: { m_1: true },
      });
      expect(withContext.met).toBe(true);

      const completedCond: MilestoneCondition = {
        ...cond,
        completed: true,
      };
      expect(evaluateMilestone(completedCond).met).toBe(true);
    });
  });

  describe("ApprovalCondition (Multi-Sig)", () => {
    it("verifies required signatures against minimum count", () => {
      const cond: ApprovalCondition = {
        id: "c_app_1",
        type: "APPROVAL",
        title: "2-of-3 Multisig",
        requiredSigners: ["alice", "bob", "carol"],
        minSignatures: 2,
        currentSignatures: ["alice"],
        met: false,
      };

      // Only 1 of 2 signatures
      expect(evaluateApproval(cond).met).toBe(false);

      // 2 signatures collected
      const cond2: ApprovalCondition = {
        ...cond,
        currentSignatures: ["alice", "bob"],
      };
      expect(evaluateApproval(cond2).met).toBe(true);

      // Context signature inclusion and deduplication
      const resContext = evaluateApproval(cond, {
        approvals: { c_app_1: ["bob", "alice"] },
      });
      expect(resContext.met).toBe(true);

      // Signatures not in requiredSigners are ignored
      const condWithUnauthorized: ApprovalCondition = {
        ...cond,
        currentSignatures: ["alice", "mallory"],
      };
      expect(evaluateApproval(condWithUnauthorized).met).toBe(false);
    });
  });

  describe("OracleCondition", () => {
    it("evaluates operators eq, gte, lte, neq against metric feed", () => {
      const condEq: OracleCondition = {
        id: "c_ora_1",
        type: "ORACLE",
        title: "Delivered status",
        oracleAddress: "GDELIVERY_ORACLE",
        metricKey: "packageStatus",
        expectedValue: "DELIVERED",
        operator: "eq",
        met: false,
      };

      expect(
        evaluateOracle(condEq, {
          oracleData: { GDELIVERY_ORACLE: { packageStatus: "DELIVERED" } },
        }).met
      ).toBe(true);

      expect(
        evaluateOracle(condEq, {
          oracleData: { GDELIVERY_ORACLE: { packageStatus: "IN_TRANSIT" } },
        }).met
      ).toBe(false);

      const condGte: OracleCondition = {
        id: "c_ora_2",
        type: "ORACLE",
        title: "Min Price",
        oracleAddress: "GPRICE_ORACLE",
        metricKey: "xlmPriceUsd",
        expectedValue: 0.15,
        operator: "gte",
        met: false,
      };

      expect(
        evaluateOracle(condGte, {
          oracleData: { GPRICE_ORACLE: { xlmPriceUsd: 0.2 } },
        }).met
      ).toBe(true);

      expect(
        evaluateOracle(condGte, {
          oracleData: { GPRICE_ORACLE: { xlmPriceUsd: 0.1 } },
        }).met
      ).toBe(false);
    });

    it("returns met=false when oracle data is missing", () => {
      const cond: OracleCondition = {
        id: "c_ora_3",
        type: "ORACLE",
        title: "Oracle Check",
        oracleAddress: "GUNKNOWN_ORACLE",
        metricKey: "temp",
        expectedValue: 25,
        operator: "eq",
        met: false,
      };
      const res = evaluateOracle(cond);
      expect(res.met).toBe(false);
      expect(res.reason).toContain("Oracle data unavailable");
    });
  });

  describe("ThresholdCondition", () => {
    it("evaluates target amount against funded amount", () => {
      const cond: ThresholdCondition = {
        id: "c_thresh_1",
        type: "THRESHOLD",
        title: "Full funding required",
        targetAmount: 50000000n,
        currentAmount: 30000000n,
        met: false,
      };

      expect(evaluateThreshold(cond).met).toBe(false);
      expect(evaluateThreshold(cond, { fundedAmount: 50000000n }).met).toBe(true);
      expect(evaluateThreshold(cond, { fundedAmount: 60000000n }).met).toBe(true);
    });
  });

  describe("CustomCondition", () => {
    it("executes custom predicate functions from evaluation context", () => {
      const cond: CustomCondition = {
        id: "c_cust_1",
        type: "CUSTOM",
        title: "KYC Verified",
        predicateKey: "verifyKYC",
        parameters: { user: "alice" },
        met: false,
      };

      const res = evaluateCustom(cond, {
        customEvaluators: {
          verifyKYC: (c) => c.parameters?.user === "alice",
        },
      });
      expect(res.met).toBe(true);

      const failRes = evaluateCustom(cond, {
        customEvaluators: {
          verifyKYC: () => false,
        },
      });
      expect(failRes.met).toBe(false);
      expect(failRes.reason).toContain("returned false");
    });
  });

  describe("Composite Condition Evaluation (evaluateConditions)", () => {
    it("handles empty conditions array as release permissible", () => {
      const res = evaluateConditions([]);
      expect(res.canRelease).toBe(true);
      expect(res.allMet).toBe(true);
      expect(res.totalConditions).toBe(0);
    });

    it("evaluates logic ALL correctly", () => {
      const cond1: TimeLockCondition = {
        id: "c1",
        type: "TIME_LOCK",
        title: "Lock",
        releaseTimestamp: 100,
        met: false,
      };
      const cond2: MilestoneCondition = {
        id: "c2",
        type: "MILESTONE",
        title: "Delivery",
        milestoneId: "m1",
        completed: false,
        met: false,
      };

      // Both pending
      const res1 = evaluateConditions([cond1, cond2], "ALL", {
        currentTimestamp: 50,
      });
      expect(res1.canRelease).toBe(false);
      expect(res1.metCount).toBe(0);
      expect(res1.failureReasons.length).toBe(2);

      // 1 of 2 met
      const res2 = evaluateConditions([cond1, cond2], "ALL", {
        currentTimestamp: 150,
        milestoneCompletions: { m1: false },
      });
      expect(res2.canRelease).toBe(false);
      expect(res2.metCount).toBe(1);

      // Both met
      const res3 = evaluateConditions([cond1, cond2], "ALL", {
        currentTimestamp: 150,
        milestoneCompletions: { m1: true },
      });
      expect(res3.canRelease).toBe(true);
      expect(res3.allMet).toBe(true);
      expect(res3.metCount).toBe(2);
    });

    it("evaluates logic ANY correctly", () => {
      const cond1: TimeLockCondition = {
        id: "c1",
        type: "TIME_LOCK",
        title: "Lock",
        releaseTimestamp: 500,
        met: false,
      };
      const cond2: MilestoneCondition = {
        id: "c2",
        type: "MILESTONE",
        title: "Milestone",
        milestoneId: "m1",
        completed: true,
        met: false,
      };

      const res = evaluateConditions([cond1, cond2], "ANY", {
        currentTimestamp: 100,
      });
      expect(res.canRelease).toBe(true);
      expect(res.metCount).toBe(1);
    });

    it("evaluates logic THRESHOLD correctly", () => {
      const conds: EscrowCondition[] = [
        { id: "c1", type: "TIME_LOCK", title: "T1", releaseTimestamp: 100, met: false },
        { id: "c2", type: "TIME_LOCK", title: "T2", releaseTimestamp: 100, met: false },
        { id: "c3", type: "TIME_LOCK", title: "T3", releaseTimestamp: 300, met: false },
      ];

      // At timestamp 200, c1 and c2 are met (2 of 3)
      const res2Of3 = evaluateConditions(conds, "THRESHOLD", { currentTimestamp: 200 }, 2);
      expect(res2Of3.canRelease).toBe(true);
      expect(res2Of3.metCount).toBe(2);

      const res3Of3 = evaluateConditions(conds, "THRESHOLD", { currentTimestamp: 200 }, 3);
      expect(res3Of3.canRelease).toBe(false);
    });
  });
});
