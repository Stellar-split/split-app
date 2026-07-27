/**
 * Platform fee configuration for invoice creation and management.
 * These values can be updated to adjust pricing over time.
 */

export const PLATFORM_FEE_CONFIG = {
  invoiceCreation: {
    percentage: 0.01, // 1% of invoice amount
    minimumXlm: 0.1, // Minimum 0.1 XLM
  },
  trustlineReserve: {
    costXlm: 0.5, // Each trustline costs 0.5 XLM in reserve
  },
  networkBaseFee: 100, // stroops (0.00001 XLM), Stellar base fee
} as const;

export const FEATURE_ADD_ON_COSTS = {
  installmentPlan: {
    costXlm: 0.5,
    description: "Installment payment plan",
  },
  customBranding: {
    costXlm: 1.0,
    description: "Custom branding and styling",
  },
} as const;

export type FeatureAddOn = keyof typeof FEATURE_ADD_ON_COSTS;

/**
 * Calculate minimum platform fee based on amount
 */
export function calculatePlatformFee(invoiceAmountXlm: number): number {
  const percentage = invoiceAmountXlm * PLATFORM_FEE_CONFIG.invoiceCreation.percentage;
  return Math.max(percentage, PLATFORM_FEE_CONFIG.invoiceCreation.minimumXlm);
}

/**
 * Calculate reserve top-up based on number of new trustlines
 */
export function calculateReserveTopUp(newTrustlineCount: number): number {
  return newTrustlineCount * PLATFORM_FEE_CONFIG.trustlineReserve.costXlm;
}

/**
 * Get cost for enabled add-ons
 */
export function getAddOnCosts(enabledAddOns: FeatureAddOn[]): number {
  return enabledAddOns.reduce((total, addon) => {
    return total + FEATURE_ADD_ON_COSTS[addon].costXlm;
  }, 0);
}
