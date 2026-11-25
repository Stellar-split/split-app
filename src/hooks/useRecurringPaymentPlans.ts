'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  RecurringPaymentPlan,
  PlanModificationInput,
  ResumeSchedulePolicy,
  SinglePlanAnalytics,
  PortfolioAnalytics,
} from '@/types/recurringPaymentPlan';
import {
  calculateCycleAmount,
  executePayment,
  catchUpDuePayments,
  getDueExecutions,
  modifyPlan as modifyPlanLogic,
  pausePlan as pausePlanLogic,
  resumePlan as resumePlanLogic,
  calculatePlanAnalytics,
  calculatePortfolioAnalytics,
} from '@/lib/recurringPaymentPlan';

const STORAGE_KEY = 'stellar_split_recurring_payment_plans';

export function useRecurringPaymentPlans() {
  const [plans, setPlans] = useState<RecurringPaymentPlan[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPlans(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load recurring payment plans from localStorage', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when plans change
  const savePlans = useCallback((updated: RecurringPaymentPlan[]) => {
    setPlans(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to persist recurring payment plans', err);
    }
  }, []);

  const createPlan = useCallback(
    (
      newPlanData: Omit<
        RecurringPaymentPlan,
        | 'id'
        | 'currentCycle'
        | 'status'
        | 'executions'
        | 'modifications'
        | 'pauseHistory'
        | 'nextExecutionDate'
        | 'lastExecutionDate'
        | 'createdAt'
        | 'updatedAt'
      >
    ): RecurringPaymentPlan => {
      const now = Date.now();
      const plan: RecurringPaymentPlan = {
        ...newPlanData,
        id: `plan_${now}_${Math.random().toString(16).substring(2, 8)}`,
        status: 'active',
        currentCycle: 0,
        nextExecutionDate: newPlanData.startDate,
        lastExecutionDate: null,
        executions: [],
        modifications: [],
        pauseHistory: [],
        createdAt: now,
        updatedAt: now,
      };

      const updated = [plan, ...plans];
      savePlans(updated);
      return plan;
    },
    [plans, savePlans]
  );

  const modifyPlan = useCallback(
    (planId: string, updates: PlanModificationInput, reason?: string) => {
      const index = plans.findIndex((p) => p.id === planId);
      if (index === -1) {
        return { success: false, error: 'Plan not found' };
      }

      const result = modifyPlanLogic(plans[index], updates, { reason });
      if (result.success) {
        const nextPlans = [...plans];
        nextPlans[index] = result.plan;
        savePlans(nextPlans);
      }
      return result;
    },
    [plans, savePlans]
  );

  const pausePlan = useCallback(
    (planId: string, reason?: string) => {
      const index = plans.findIndex((p) => p.id === planId);
      if (index === -1) {
        return { success: false, error: 'Plan not found' };
      }

      const result = pausePlanLogic(plans[index], Date.now(), reason);
      if (result.success) {
        const nextPlans = [...plans];
        nextPlans[index] = result.plan;
        savePlans(nextPlans);
      }
      return result;
    },
    [plans, savePlans]
  );

  const resumePlan = useCallback(
    (planId: string, policy: ResumeSchedulePolicy = 'catch_up') => {
      const index = plans.findIndex((p) => p.id === planId);
      if (index === -1) {
        return { success: false, error: 'Plan not found' };
      }

      const result = resumePlanLogic(plans[index], Date.now(), policy);
      if (result.success) {
        const nextPlans = [...plans];
        nextPlans[index] = result.plan;
        savePlans(nextPlans);
      }
      return result;
    },
    [plans, savePlans]
  );

  const cancelPlan = useCallback(
    (planId: string, reason: string = 'User cancelled plan') => {
      const index = plans.findIndex((p) => p.id === planId);
      if (index === -1) {
        return { success: false, error: 'Plan not found' };
      }

      const plan = plans[index];
      if (plan.status === 'completed' || plan.status === 'cancelled') {
        return { success: false, error: `Cannot cancel a plan that is '${plan.status}'` };
      }

      const now = Date.now();
      const cancelledPlan: RecurringPaymentPlan = {
        ...plan,
        status: 'cancelled',
        nextExecutionDate: null,
        updatedAt: now,
        modifications: [
          ...plan.modifications,
          {
            id: `mod_cancel_${now}`,
            timestamp: now,
            field: 'status',
            oldValue: plan.status,
            newValue: 'cancelled',
            effectiveFromCycle: plan.currentCycle + 1,
            reason,
          },
        ],
      };

      const nextPlans = [...plans];
      nextPlans[index] = cancelledPlan;
      savePlans(nextPlans);
      return { success: true, plan: cancelledPlan };
    },
    [plans, savePlans]
  );

  const executePlanPayment = useCallback(
    (planId: string, txDetails?: { txHash?: string; note?: string }) => {
      const index = plans.findIndex((p) => p.id === planId);
      if (index === -1) {
        return { success: false, error: 'Plan not found' };
      }

      const result = executePayment(plans[index], Date.now(), txDetails);
      if (result.success) {
        const nextPlans = [...plans];
        nextPlans[index] = result.plan;
        savePlans(nextPlans);
      }
      return result;
    },
    [plans, savePlans]
  );

  const catchUpPlan = useCallback(
    async (planId: string) => {
      const index = plans.findIndex((p) => p.id === planId);
      if (index === -1) {
        return { success: false, error: 'Plan not found' };
      }

      const result = await catchUpDuePayments(plans[index], Date.now());
      if (result.executedCount > 0) {
        const nextPlans = [...plans];
        nextPlans[index] = result.plan;
        savePlans(nextPlans);
      }
      return result;
    },
    [plans, savePlans]
  );

  const getPlanDueExecutions = useCallback(
    (planId: string) => {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return [];
      return getDueExecutions(plan, Date.now());
    },
    [plans]
  );

  const getPlanAnalytics = useCallback(
    (planId: string): SinglePlanAnalytics | null => {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return null;
      return calculatePlanAnalytics(plan, Date.now());
    },
    [plans]
  );

  const portfolioAnalytics: PortfolioAnalytics = useMemo(() => {
    return calculatePortfolioAnalytics(plans, { currentTime: Date.now() });
  }, [plans]);

  return {
    plans,
    isLoaded,
    createPlan,
    modifyPlan,
    pausePlan,
    resumePlan,
    cancelPlan,
    executePlanPayment,
    catchUpPlan,
    getPlanDueExecutions,
    getPlanAnalytics,
    portfolioAnalytics,
  };
}
