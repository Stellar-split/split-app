import type {
  RecurringPaymentPlan,
  PlanModificationInput,
  PlanModificationRecord,
  PlanIntervalConfig,
  PlanAmountConfig,
} from '@/types/recurringPaymentPlan';
import { validateAmountConfig } from './amountEngine';
import { calculateScheduledDateForCycle } from './scheduleEngine';

/**
 * Validates updated interval configuration.
 */
export function validateIntervalConfig(config: Partial<PlanIntervalConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.intervalCount !== undefined && config.intervalCount < 1) {
    errors.push('intervalCount must be at least 1');
  }

  if (config.customIntervalDays !== undefined && config.customIntervalDays < 1) {
    errors.push('customIntervalDays must be at least 1');
  }

  if (config.dayOfMonth !== undefined && (config.dayOfMonth < 1 || config.dayOfMonth > 31)) {
    errors.push('dayOfMonth must be between 1 and 31');
  }

  if (config.dayOfWeek !== undefined && (config.dayOfWeek < 0 || config.dayOfWeek > 6)) {
    errors.push('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Safely applies modifications to a plan, maintaining an audit trail and guaranteeing
 * that completed past payments remain strictly immutable.
 */
export function modifyPlan(
  plan: RecurringPaymentPlan,
  updates: PlanModificationInput,
  options?: { timestamp?: number; reason?: string }
): {
  success: boolean;
  plan: RecurringPaymentPlan;
  error?: string;
  modifications?: PlanModificationRecord[];
} {
  const now = options?.timestamp ?? Date.now();
  const reason = options?.reason ?? 'Plan updated by user';

  // 1. Plan state guard
  if (plan.status === 'completed' || plan.status === 'cancelled') {
    return {
      success: false,
      plan,
      error: `Cannot modify a plan that is '${plan.status}'`,
    };
  }

  // 2. Validate maxCycles constraints
  if (updates.maxCycles !== undefined && updates.maxCycles !== null) {
    if (updates.maxCycles < 1) {
      return {
        success: false,
        plan,
        error: 'maxCycles must be at least 1',
      };
    }
    if (updates.maxCycles < plan.currentCycle) {
      return {
        success: false,
        plan,
        error: `Cannot reduce maxCycles (${updates.maxCycles}) below already completed cycles (${plan.currentCycle})`,
      };
    }
  }

  // 3. Validate endDate constraints
  if (updates.endDate !== undefined && updates.endDate !== null) {
    if (plan.lastExecutionDate && updates.endDate < plan.lastExecutionDate) {
      return {
        success: false,
        plan,
        error: `Cannot set endDate before the last executed payment date`,
      };
    }
  }

  // 4. Validate intervalConfig if modified
  if (updates.intervalConfig) {
    const mergedInterval: PlanIntervalConfig = {
      ...plan.intervalConfig,
      ...updates.intervalConfig,
    };
    const validation = validateIntervalConfig(mergedInterval);
    if (!validation.valid) {
      return {
        success: false,
        plan,
        error: `Invalid interval configuration: ${validation.errors.join(', ')}`,
      };
    }
  }

  // 5. Validate amountConfig if modified
  if (updates.amountConfig) {
    const mergedAmount: PlanAmountConfig = {
      ...plan.amountConfig,
      ...updates.amountConfig,
    };
    const validation = validateAmountConfig(mergedAmount);
    if (!validation.valid) {
      return {
        success: false,
        plan,
        error: `Invalid amount configuration: ${validation.errors.join(', ')}`,
      };
    }
  }

  // 6. Validate recipients if modified
  if (updates.recipients) {
    const hasPercentages = updates.recipients.some((r) => r.sharePercentage !== undefined);
    if (hasPercentages) {
      const totalPct = updates.recipients.reduce((acc, r) => acc + (r.sharePercentage || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        return {
          success: false,
          plan,
          error: `Recipient share percentages must total 100% (currently ${totalPct}%)`,
        };
      }
    }
  }

  // 7. Track modifications in audit trail
  const newModifications: PlanModificationRecord[] = [];
  const effectiveCycle = plan.currentCycle + 1;

  const checkAndRecord = (field: string, oldVal: unknown, newVal: unknown) => {
    if (newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      newModifications.push({
        id: `mod_${plan.id}_${field}_${now}_${Math.random().toString(16).substring(2, 6)}`,
        timestamp: now,
        field,
        oldValue: oldVal,
        newValue: newVal,
        effectiveFromCycle: effectiveCycle,
        reason,
      });
    }
  };

  if (updates.title !== undefined) checkAndRecord('title', plan.title, updates.title);
  if (updates.description !== undefined) checkAndRecord('description', plan.description, updates.description);
  if (updates.recipients !== undefined) checkAndRecord('recipients', plan.recipients, updates.recipients);
  if (updates.maxCycles !== undefined) checkAndRecord('maxCycles', plan.maxCycles, updates.maxCycles);
  if (updates.endDate !== undefined) checkAndRecord('endDate', plan.endDate, updates.endDate);
  if (updates.intervalConfig !== undefined) checkAndRecord('intervalConfig', plan.intervalConfig, { ...plan.intervalConfig, ...updates.intervalConfig });
  if (updates.amountConfig !== undefined) checkAndRecord('amountConfig', plan.amountConfig, { ...plan.amountConfig, ...updates.amountConfig });

  // 8. Safely construct modified plan
  const updatedInterval: PlanIntervalConfig = updates.intervalConfig
    ? { ...plan.intervalConfig, ...updates.intervalConfig }
    : plan.intervalConfig;

  const updatedAmount: PlanAmountConfig = updates.amountConfig
    ? { ...plan.amountConfig, ...updates.amountConfig }
    : plan.amountConfig;

  let updatedNextDate = plan.nextExecutionDate;
  if (updates.intervalConfig && plan.status === 'active') {
    // Recalculate upcoming scheduled execution date using new interval settings
    updatedNextDate = calculateScheduledDateForCycle(
      { startDate: plan.startDate, intervalConfig: updatedInterval },
      plan.currentCycle + 1
    );
  }

  // Check if modified maxCycles or endDate immediately concludes plan
  let status = plan.status;
  if (updates.maxCycles !== undefined && updates.maxCycles !== null && plan.currentCycle >= updates.maxCycles) {
    status = 'completed';
    updatedNextDate = null;
  }
  if (updates.endDate !== undefined && updates.endDate !== null && updatedNextDate !== null && updatedNextDate > updates.endDate) {
    status = 'completed';
    updatedNextDate = null;
  }

  const modifiedPlan: RecurringPaymentPlan = {
    ...plan,
    title: updates.title ?? plan.title,
    description: updates.description ?? plan.description,
    recipients: updates.recipients ?? plan.recipients,
    maxCycles: updates.maxCycles !== undefined ? updates.maxCycles : plan.maxCycles,
    endDate: updates.endDate !== undefined ? updates.endDate : plan.endDate,
    intervalConfig: updatedInterval,
    amountConfig: updatedAmount,
    status,
    nextExecutionDate: updatedNextDate,
    modifications: [...plan.modifications, ...newModifications],
    updatedAt: now,
  };

  return {
    success: true,
    plan: modifiedPlan,
    modifications: newModifications,
  };
}
