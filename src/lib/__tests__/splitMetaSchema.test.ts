import { describe, expect, it } from "vitest";
import {
  RecipientLineSchema,
  SplitMetaSchema,
  parseSplitMeta,
  safeParseSplitMeta,
} from "../../lib/splitMetaSchema";
import type { RecipientLineInput, SplitMetaInput } from "../../lib/splitMetaSchema";

describe("RecipientLineSchema", () => {
  it("accepts a valid line", () => {
    const line: RecipientLineInput = {
      address: "GABC123",
      sharePercent: 50,
      taxRatePercent: 10,
      fixedFeeXLM: 0.5,
    };
    const result = RecipientLineSchema.safeParse(line);
    expect(result.success).toBe(true);
  });

  it("rejects empty address", () => {
    const result = RecipientLineSchema.safeParse({
      address: "",
      sharePercent: 50,
      taxRatePercent: 0,
      fixedFeeXLM: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects share percent < 0", () => {
    const result = RecipientLineSchema.safeParse({
      address: "G1",
      sharePercent: -1,
      taxRatePercent: 0,
      fixedFeeXLM: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects share percent > 100", () => {
    const result = RecipientLineSchema.safeParse({
      address: "G1",
      sharePercent: 101,
      taxRatePercent: 0,
      fixedFeeXLM: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects tax rate < 0", () => {
    const result = RecipientLineSchema.safeParse({
      address: "G1",
      sharePercent: 100,
      taxRatePercent: -5,
      fixedFeeXLM: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects tax rate > 100", () => {
    const result = RecipientLineSchema.safeParse({
      address: "G1",
      sharePercent: 100,
      taxRatePercent: 150,
      fixedFeeXLM: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative fixed fee", () => {
    const result = RecipientLineSchema.safeParse({
      address: "G1",
      sharePercent: 100,
      taxRatePercent: 0,
      fixedFeeXLM: -0.1,
    });
    expect(result.success).toBe(false);
  });
});

describe("SplitMetaSchema", () => {
  it("accepts a complete valid payload", () => {
    const meta: SplitMetaInput = {
      totalAmount: 1000,
      assetCode: "USDC",
      recipients: [
        { address: "G1", sharePercent: 70, taxRatePercent: 10, fixedFeeXLM: 1 },
        { address: "G2", sharePercent: 30, taxRatePercent: 0, fixedFeeXLM: 0 },
      ],
    };
    const result = SplitMetaSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });

  it("rejects share sum != 100% with recipients present", () => {
    const meta = {
      totalAmount: 1000,
      assetCode: "XLM",
      recipients: [
        { address: "G1", sharePercent: 50, taxRatePercent: 0, fixedFeeXLM: 0 },
        { address: "G2", sharePercent: 30, taxRatePercent: 0, fixedFeeXLM: 0 },
      ],
    };
    const result = SplitMetaSchema.safeParse(meta);
    expect(result.success).toBe(false);
    if (!result.success) {
      const shareIssue = result.error.issues.find((i) =>
        i.message.includes("sum to 100")
      );
      expect(shareIssue).toBeDefined();
    }
  });

  it("accepts empty recipient array (skips 100% check)", () => {
    const meta = {
      totalAmount: 0,
      assetCode: "USDC",
      recipients: [],
    };
    const result = SplitMetaSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });

  it("rejects negative totalAmount", () => {
    const meta = {
      totalAmount: -5,
      assetCode: "USDC",
      recipients: [],
    };
    const result = SplitMetaSchema.safeParse(meta);
    expect(result.success).toBe(false);
  });

  it("rejects invalid asset code", () => {
    const meta = {
      totalAmount: 100,
      assetCode: "EUR",
      recipients: [],
    };
    const result = SplitMetaSchema.safeParse(meta);
    expect(result.success).toBe(false);
  });
});

describe("parseSplitMeta", () => {
  it("returns data for valid input", () => {
    const raw = {
      totalAmount: 500,
      assetCode: "XLM",
      recipients: [
        { address: "G1", sharePercent: 100, taxRatePercent: 0, fixedFeeXLM: 0 },
      ],
    };
    const parsed = parseSplitMeta(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.totalAmount).toBe(500);
  });

  it("returns null for invalid input", () => {
    expect(parseSplitMeta(null)).toBeNull();
    expect(parseSplitMeta({ garbage: true })).toBeNull();
    expect(parseSplitMeta("a string")).toBeNull();
  });
});

describe("safeParseSplitMeta", () => {
  it("returns success for valid payload", () => {
    const r = safeParseSplitMeta({
      totalAmount: 250.5,
      assetCode: "USDC",
      recipients: [
        { address: "G1", sharePercent: 100, taxRatePercent: 5, fixedFeeXLM: 2 },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.data?.totalAmount).toBe(250.5);
  });

  it("returns error object with issues for invalid payload", () => {
    const r = safeParseSplitMeta({
      totalAmount: 100,
      assetCode: "USDC",
      recipients: [
        { address: "G1", sharePercent: 90, taxRatePercent: 0, fixedFeeXLM: 0 },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
    expect(r.error?.issues.length).toBeGreaterThan(0);
  });
});

describe("InstallmentMilestoneSchema and SplitMeta installments", () => {
  it("accepts valid installments that sum to totalAmount", () => {
    const result = SplitMetaSchema.safeParse({
      totalAmount: 1000,
      assetCode: "USDC",
      recipients: [],
      installments: [
        { id: "1", amount: 500, dueDate: 1700000000, status: "upcoming" },
        { id: "2", amount: 500, dueDate: 1700086400, status: "upcoming" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects installments whose amounts do not sum to totalAmount", () => {
    const result = SplitMetaSchema.safeParse({
      totalAmount: 1000,
      assetCode: "USDC",
      recipients: [],
      installments: [
        { id: "1", amount: 400, dueDate: 1700000000, status: "upcoming" },
        { id: "2", amount: 500, dueDate: 1700086400, status: "upcoming" },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const installmentIssue = result.error.issues.find((i) => i.path.includes("installments"));
      expect(installmentIssue).toBeDefined();
    }
  });

  it("accepts no installments (single-payment mode)", () => {
    const result = SplitMetaSchema.safeParse({
      totalAmount: 1000,
      assetCode: "USDC",
      recipients: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty installments array", () => {
    const result = SplitMetaSchema.safeParse({
      totalAmount: 1000,
      assetCode: "USDC",
      recipients: [],
      installments: [],
    });
    expect(result.success).toBe(true);
  });
});
