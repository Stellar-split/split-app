import { describe, it, expect } from "vitest";
import {
  calculatePlatformFee,
  calculateReserveTopUp,
  getAddOnCosts,
  PLATFORM_FEE_CONFIG,
  FEATURE_ADD_ON_COSTS,
  type FeatureAddOn,
} from "../feeConfig";

describe("calculatePlatformFee", () => {
  it("charges the percentage fee when it exceeds the minimum", () => {
    // 1% of 1000 = 10, which is above the 0.1 XLM minimum.
    expect(calculatePlatformFee(1000)).toBeCloseTo(10, 10);
  });

  it("falls back to the minimum fee for small amounts", () => {
    // 1% of 1 XLM = 0.01, below the 0.1 XLM minimum.
    expect(calculatePlatformFee(1)).toBe(PLATFORM_FEE_CONFIG.invoiceCreation.minimumXlm);
  });

  it("returns the minimum fee for a zero amount", () => {
    expect(calculatePlatformFee(0)).toBe(PLATFORM_FEE_CONFIG.invoiceCreation.minimumXlm);
  });

  it("handles negative amounts by still returning the minimum fee", () => {
    expect(calculatePlatformFee(-500)).toBe(PLATFORM_FEE_CONFIG.invoiceCreation.minimumXlm);
  });

  it("scales linearly once above the minimum threshold", () => {
    const small = calculatePlatformFee(2000);
    const large = calculatePlatformFee(4000);
    expect(large).toBeCloseTo(small * 2, 10);
  });
});

describe("calculateReserveTopUp", () => {
  it("returns 0 for zero new trustlines", () => {
    expect(calculateReserveTopUp(0)).toBe(0);
  });

  it("multiplies trustline count by the per-trustline reserve cost", () => {
    expect(calculateReserveTopUp(3)).toBe(3 * PLATFORM_FEE_CONFIG.trustlineReserve.costXlm);
  });

  it("handles a large number of trustlines", () => {
    expect(calculateReserveTopUp(100)).toBe(100 * PLATFORM_FEE_CONFIG.trustlineReserve.costXlm);
  });
});

describe("getAddOnCosts", () => {
  it("returns 0 when no add-ons are enabled", () => {
    expect(getAddOnCosts([])).toBe(0);
  });

  it("sums the cost of a single add-on", () => {
    expect(getAddOnCosts(["installmentPlan"])).toBe(
      FEATURE_ADD_ON_COSTS.installmentPlan.costXlm
    );
  });

  it("sums the cost of multiple add-ons", () => {
    const addOns: FeatureAddOn[] = ["installmentPlan", "customBranding"];
    const expected =
      FEATURE_ADD_ON_COSTS.installmentPlan.costXlm + FEATURE_ADD_ON_COSTS.customBranding.costXlm;
    expect(getAddOnCosts(addOns)).toBe(expected);
  });

  it("counts duplicate add-ons multiple times", () => {
    const addOns: FeatureAddOn[] = ["installmentPlan", "installmentPlan"];
    expect(getAddOnCosts(addOns)).toBe(FEATURE_ADD_ON_COSTS.installmentPlan.costXlm * 2);
  });
});
