import type {
  PlanAmountConfig,
  PlanScheduledAmount,
  PlanAmountTier,
  PlanPercentageStep,
  PlanMilestoneAmount,
} from '@/types/recurringPaymentPlan';

/**
 * Rounds a number to a specified number of decimal places (default 7 for Stellar precision).
 */
export function roundAmount(amount: number, decimals: number = 7): number {
  if (!Number.isFinite(amount)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

/**
 * Validates a PlanAmountConfig object.
 */
export function validateAmountConfig(config: PlanAmountConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof config.baseAmount !== 'number' || isNaN(config.baseAmount) || config.baseAmount < 0) {
    errors.push('baseAmount must be a non-negative number');
  }

  if (!config.currency || typeof config.currency !== 'string') {
    errors.push('currency is required');
  }

  if (config.minimumAmount !== undefined && config.minimumAmount < 0) {
    errors.push('minimumAmount cannot be negative');
  }

  if (config.maximumAmount !== undefined && config.maximumAmount < 0) {
    errors.push('maximumAmount cannot be negative');
  }

  if (
    config.minimumAmount !== undefined &&
    config.maximumAmount !== undefined &&
    config.minimumAmount > config.maximumAmount
  ) {
    errors.push('minimumAmount cannot exceed maximumAmount');
  }

  switch (config.type) {
    case 'fixed':
      break;

    case 'scheduled':
      if (!Array.isArray(config.scheduledAmounts) || config.scheduledAmounts.length === 0) {
        errors.push('scheduledAmounts must be a non-empty array for scheduled variation');
      } else {
        for (const item of config.scheduledAmounts) {
          if (item.cycle < 1) {
            errors.push(`Cycle must be >= 1 (got ${item.cycle})`);
          }
          if (item.amount < 0) {
            errors.push(`Amount for cycle ${item.cycle} cannot be negative`);
          }
        }
      }
      break;

    case 'tiered':
      if (!Array.isArray(config.tieredAmounts) || config.tieredAmounts.length === 0) {
        errors.push('tieredAmounts must be a non-empty array for tiered variation');
      } else {
        for (const tier of config.tieredAmounts) {
          if (tier.upToCycle < 1) {
            errors.push(`upToCycle must be >= 1 (got ${tier.upToCycle})`);
          }
          if (tier.amount < 0) {
            errors.push(`Amount for tier upToCycle ${tier.upToCycle} cannot be negative`);
          }
        }
      }
      break;

    case 'percentage_step':
      if (!config.percentageStep) {
        errors.push('percentageStep configuration is required for percentage_step variation');
      } else {
        if (config.percentageStep.stepFrequencyCycles < 1) {
          errors.push('stepFrequencyCycles must be at least 1');
        }
        if (
          config.percentageStep.minAmount !== undefined &&
          config.percentageStep.maxAmount !== undefined &&
          config.percentageStep.minAmount > config.percentageStep.maxAmount
        ) {
          errors.push('percentageStep minAmount cannot exceed maxAmount');
        }
      }
      break;

    case 'milestone':
      if (!Array.isArray(config.milestoneAmounts) || config.milestoneAmounts.length === 0) {
        errors.push('milestoneAmounts must be a non-empty array for milestone variation');
      } else {
        for (const m of config.milestoneAmounts) {
          if (m.cycle < 1) {
            errors.push(`Milestone cycle must be >= 1 (got ${m.cycle})`);
          }
          if (m.amount < 0) {
            errors.push(`Milestone amount for cycle ${m.cycle} cannot be negative`);
          }
        }
      }
      break;

    default:
      errors.push(`Unsupported amount variation type: ${(config as any).type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates the exact amount due for a given cycle (1-based index) based on amountConfig.
 */
export function calculateCycleAmount(
  config: PlanAmountConfig,
  cycle: number
): number {
  if (cycle < 1) {
    throw new Error(`Cycle index must be positive (received: ${cycle})`);
  }

  let amount = config.baseAmount;

  switch (config.type) {
    case 'fixed':
      amount = config.baseAmount;
      break;

    case 'scheduled': {
      if (config.scheduledAmounts && config.scheduledAmounts.length > 0) {
        const sorted = [...config.scheduledAmounts].sort((a, b) => a.cycle - b.cycle);
        const exact = sorted.find((s) => s.cycle === cycle);
        if (exact) {
          amount = exact.amount;
        } else {
          // If cycle is beyond the highest defined schedule cycle, use the last specified amount
          const last = sorted[sorted.length - 1];
          if (cycle > last.cycle) {
            amount = last.amount;
          } else {
            // Find closest preceding cycle
            const preceding = sorted.filter((s) => s.cycle < cycle);
            amount = preceding.length > 0 ? preceding[preceding.length - 1].amount : config.baseAmount;
          }
        }
      }
      break;
    }

    case 'tiered': {
      if (config.tieredAmounts && config.tieredAmounts.length > 0) {
        const sorted = [...config.tieredAmounts].sort((a, b) => a.upToCycle - b.upToCycle);
        const matchedTier = sorted.find((t) => cycle <= t.upToCycle);
        if (matchedTier) {
          amount = matchedTier.amount;
        } else {
          // If past highest tier, use the final tier amount
          amount = sorted[sorted.length - 1].amount;
        }
      }
      break;
    }

    case 'percentage_step': {
      if (config.percentageStep) {
        const { percentageChange, stepFrequencyCycles, compound = true, minAmount, maxAmount } =
          config.percentageStep;
        const freq = Math.max(1, stepFrequencyCycles);
        const steps = Math.floor((cycle - 1) / freq);

        if (steps > 0) {
          if (compound) {
            amount = config.baseAmount * Math.pow(1 + percentageChange / 100, steps);
          } else {
            amount = config.baseAmount * (1 + (percentageChange / 100) * steps);
          }
        }

        if (minAmount !== undefined && amount < minAmount) {
          amount = minAmount;
        }
        if (maxAmount !== undefined && amount > maxAmount) {
          amount = maxAmount;
        }
      }
      break;
    }

    case 'milestone': {
      if (config.milestoneAmounts && config.milestoneAmounts.length > 0) {
        const milestone = config.milestoneAmounts.find((m) => m.cycle === cycle);
        if (milestone) {
          amount = milestone.amount;
        } else {
          amount = config.baseAmount;
        }
      }
      break;
    }
  }

  // Apply global minimum & maximum bounds if set
  if (config.minimumAmount !== undefined && amount < config.minimumAmount) {
    amount = config.minimumAmount;
  }
  if (config.maximumAmount !== undefined && amount > config.maximumAmount) {
    amount = config.maximumAmount;
  }

  // Ensure never negative
  return roundAmount(Math.max(0, amount));
}

/**
 * Projects total amount across a range of cycles [startCycle, endCycle].
 */
export function projectTotalAmount(
  config: PlanAmountConfig,
  startCycle: number,
  endCycle: number
): number {
  if (startCycle > endCycle) return 0;
  let total = 0;
  for (let c = startCycle; c <= endCycle; c++) {
    total += calculateCycleAmount(config, c);
  }
  return roundAmount(total);
}
