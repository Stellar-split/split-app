import { describe, it, expect } from "vitest";
import { StrKey } from "@stellar/stellar-sdk";
import {
  WIZARD_STEPS,
  REVIEW_STEP,
  FIELD_HELP,
  validateWizardStep,
  firstInvalidStep,
  type WizardState,
} from "@/lib/invoiceWizard";

const TOKEN = StrKey.encodeContract(Buffer.alloc(32, 1));
const ALICE = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
const BOB = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 3));

function validState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    token: TOKEN,
    deadlineDays: 7,
    isClone: false,
    cloneDeadlineError: null,
    recurring: false,
    intervalDays: 7,
    recipients: [
      { address: ALICE, amount: "10" },
      { address: BOB, amount: "5.5" },
    ],
    equalSplit: false,
    totalAmount: "",
    splitError: null,
    cosigners: [],
    cosignerThreshold: 1,
    ...overrides,
  };
}

describe("invoice wizard (#891)", () => {
  it("defines four steps ending in review, each with a description", () => {
    expect(WIZARD_STEPS.map((s) => s.label)).toEqual([
      "Basic Info",
      "Recipients",
      "Options",
      "Review & Submit",
    ]);
    expect(REVIEW_STEP).toBe(3);
    WIZARD_STEPS.forEach((s) => expect(s.description.length).toBeGreaterThan(0));
  });

  it("has help text for every field", () => {
    Object.values(FIELD_HELP).forEach((text) => expect(text.trim().length).toBeGreaterThan(10));
  });

  it("accepts a fully valid state", () => {
    expect(firstInvalidStep(validState())).toBe(-1);
  });

  describe("step 1: basic info", () => {
    it("requires a token", () => {
      const r = validateWizardStep(0, validState({ token: "" }));
      expect(r.valid).toBe(false);
      expect(r.fieldErrors.token).toMatch(/required/);
    });

    it("rejects a token that only looks like a contract address", () => {
      const r = validateWizardStep(0, validState({ token: "Cnotarealcontract" }));
      expect(r.valid).toBe(false);
      expect(r.fieldErrors.token).toBeDefined();
    });

    it.each([0, -3, 366, 2.5, NaN])("rejects a deadline of %s days", (days) => {
      const r = validateWizardStep(0, validState({ deadlineDays: days }));
      expect(r.fieldErrors.deadlineDays).toBeDefined();
    });

    it.each([1, 30, 365])("accepts a deadline of %s days", (days) => {
      expect(validateWizardStep(0, validState({ deadlineDays: days })).valid).toBe(true);
    });

    it("uses the clone deadline instead of days when cloning", () => {
      const state = validState({ isClone: true, deadlineDays: 0, cloneDeadlineError: "Deadline must be in the future" });
      const r = validateWizardStep(0, state);
      expect(r.fieldErrors.deadlineDays).toBeUndefined();
      expect(r.fieldErrors.cloneDeadline).toBe("Deadline must be in the future");
    });
  });

  describe("step 2: recipients", () => {
    it("requires at least one recipient", () => {
      const r = validateWizardStep(1, validState({ recipients: [{ address: "", amount: "" }] }));
      expect(r.message).toBe("At least one recipient is required");
    });

    it("rejects an invalid Stellar address and names the row", () => {
      const r = validateWizardStep(1, validState({
        recipients: [{ address: ALICE, amount: "1" }, { address: "G".padEnd(56, "A"), amount: "1" }],
      }));
      expect(r.fieldErrors.recipients).toMatch(/Recipient 2/);
    });

    it("rejects the same wallet twice", () => {
      const r = validateWizardStep(1, validState({
        recipients: [{ address: ALICE, amount: "1" }, { address: ALICE, amount: "2" }],
      }));
      expect(r.fieldErrors.recipients).toMatch(/more than once/);
    });

    it.each(["", "0", "-1", "abc"])("rejects an amount of %j", (amount) => {
      const r = validateWizardStep(1, validState({ recipients: [{ address: ALICE, amount }] }));
      expect(r.fieldErrors.recipients).toMatch(/greater than zero/);
    });

    it("in equal-split mode checks the total, not per-row amounts", () => {
      const rows = [{ address: ALICE, amount: "" }, { address: BOB, amount: "" }];
      expect(validateWizardStep(1, validState({ equalSplit: true, totalAmount: "100", recipients: rows })).valid).toBe(true);

      const r = validateWizardStep(1, validState({ equalSplit: true, totalAmount: "", recipients: rows }));
      expect(r.fieldErrors.totalAmount).toBeDefined();
    });

    it("surfaces a split calculator error", () => {
      const r = validateWizardStep(1, validState({ splitError: "Shares must add up to 100%" }));
      expect(r.valid).toBe(false);
      expect(r.message).toBe("Shares must add up to 100%");
    });
  });

  describe("step 3: options", () => {
    it("is valid with no co-signers", () => {
      expect(validateWizardStep(2, validState()).valid).toBe(true);
    });

    it("rejects a threshold above the number of co-signers", () => {
      const r = validateWizardStep(2, validState({ cosigners: [ALICE], cosignerThreshold: 2 }));
      expect(r.fieldErrors.cosigners).toBeDefined();
    });
  });

  it("firstInvalidStep points at the earliest failing step", () => {
    expect(firstInvalidStep(validState({ token: "", recipients: [] }))).toBe(0);
    expect(firstInvalidStep(validState({ recipients: [] }))).toBe(1);
    expect(firstInvalidStep(validState({ cosigners: [ALICE], cosignerThreshold: 0 }))).toBe(2);
  });
});
