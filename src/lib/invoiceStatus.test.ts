import { describe, it, expect, beforeEach } from "vitest";
import {
  canTransition,
  canReleaseInvoice,
  getReleaseCheck,
  isReleaseBlocked,
  transitionToDisputed,
  transitionToReleased,
  STATUS_TRANSITIONS,
} from "./invoiceStatus";
import { createMilestone, addCondition } from "./invoiceMilestones";
import { createDispute } from "./arbitrators";

describe("invoiceStatus state machine", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  describe("canTransition", () => {
    it("allows transitions listed in STATUS_TRANSITIONS", () => {
      for (const from of Object.keys(STATUS_TRANSITIONS) as Array<
        keyof typeof STATUS_TRANSITIONS
      >) {
        for (const to of STATUS_TRANSITIONS[from]) {
          expect(canTransition(from, to)).toBe(true);
        }
      }
    });

    it("rejects transitions that are not listed", () => {
      expect(canTransition("Pending", "Released")).toBe(false);
      expect(canTransition("Released", "Funded")).toBe(false);
    });

    it("rejects any transition out of Archived", () => {
      expect(canTransition("Archived", "Pending")).toBe(false);
      expect(STATUS_TRANSITIONS.Archived).toHaveLength(0);
    });
  });

  describe("getReleaseCheck / canReleaseInvoice / isReleaseBlocked", () => {
    it("allows release when there are no milestones and no disputes", () => {
      const check = getReleaseCheck("inv-no-milestones");
      expect(check.allowed).toBe(true);
      expect(check.reasons).toHaveLength(0);
      expect(canReleaseInvoice("inv-no-milestones")).toBe(true);
      expect(isReleaseBlocked("inv-no-milestones")).toBe(false);
    });

    it("blocks release when a required milestone condition is unmet", () => {
      const invoiceId = "inv-with-milestone";
      const milestone = createMilestone(invoiceId, 100);
      addCondition(invoiceId, milestone.id, {
        type: "deliverable",
        description: "Deliver final asset",
        required: true,
      });

      const check = getReleaseCheck(invoiceId);
      expect(check.allowed).toBe(false);
      expect(check.reasons).toContain(
        "Milestone conditions have not been satisfied",
      );
      expect(canReleaseInvoice(invoiceId)).toBe(false);
      expect(isReleaseBlocked(invoiceId)).toBe(true);
    });

    it("blocks release when the invoice has an active dispute", () => {
      const invoiceId = "inv-disputed";
      createDispute({
        invoiceId,
        initiator: "GRAISER",
        respondent: "GCOUNTER",
        reason: "Work not delivered",
        description: "Deliverable was never provided.",
      });

      const check = getReleaseCheck(invoiceId);
      expect(check.allowed).toBe(false);
      expect(check.reasons).toContain("Invoice has an unresolved dispute");
    });
  });

  describe("transitionToDisputed", () => {
    it("returns Disputed when transition is valid", () => {
      expect(transitionToDisputed("Funded")).toBe("Disputed");
    });

    it("throws when transition is invalid", () => {
      expect(() => transitionToDisputed("Archived")).toThrow(
        /Invalid status transition/,
      );
    });
  });

  describe("transitionToReleased", () => {
    it("returns Released when transition is valid and release is unblocked", () => {
      const invoiceId = "inv-release-ok";
      expect(transitionToReleased(invoiceId, "Funded")).toBe("Released");
    });

    it("throws when the status transition itself is invalid", () => {
      expect(() => transitionToReleased("inv-x", "Pending")).toThrow(
        /Invalid status transition/,
      );
    });

    it("throws when release is blocked by an unmet milestone", () => {
      const invoiceId = "inv-release-blocked";
      const milestone = createMilestone(invoiceId, 100);
      addCondition(invoiceId, milestone.id, {
        type: "approval",
        description: "Client sign-off",
        required: true,
      });

      expect(() => transitionToReleased(invoiceId, "Funded")).toThrow(
        /Release blocked/,
      );
    });
  });
});
