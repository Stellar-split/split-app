'use client';

import React, { useState } from 'react';
import type {
  RecurringPaymentPlan,
  PlanFrequency,
  AmountVariationType,
  ResumeSchedulePolicy,
  PlanModificationInput,
} from '@/types/recurringPaymentPlan';
import { useRecurringPaymentPlans } from '@/hooks/useRecurringPaymentPlans';
import { generateUpcomingSchedule, roundAmount } from '@/lib/recurringPaymentPlan';

export default function RecurringPaymentPlanManager() {
  const {
    plans,
    isLoaded,
    createPlan,
    modifyPlan,
    pausePlan,
    resumePlan,
    cancelPlan,
    executePlanPayment,
    catchUpPlan,
    getPlanAnalytics,
    portfolioAnalytics,
  } = useRecurringPaymentPlans();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [resumePolicy, setResumePolicy] = useState<ResumeSchedulePolicy>('catch_up');

  // Form states for Create Plan
  const [newTitle, setNewTitle] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [newPayer, setNewPayer] = useState('');
  const [newFrequency, setNewFrequency] = useState<PlanFrequency>('monthly');
  const [newCustomDays, setNewCustomDays] = useState<number>(30);
  const [newIntervalCount, setNewIntervalCount] = useState<number>(1);
  const [newAmountType, setNewAmountType] = useState<AmountVariationType>('fixed');
  const [newBaseAmount, setNewBaseAmount] = useState<number>(100);
  const [newCurrency, setNewCurrency] = useState('USDC');
  const [newMaxCycles, setNewMaxCycles] = useState<number | undefined>(undefined);
  const [newPercentageChange, setNewPercentageChange] = useState<number>(5);
  const [newStepFrequency, setNewStepFrequency] = useState<number>(2);

  // Form states for Modify Plan
  const [modTitle, setModTitle] = useState('');
  const [modBaseAmount, setModBaseAmount] = useState<number>(100);
  const [modMaxCycles, setModMaxCycles] = useState<number | undefined>(undefined);
  const [modReason, setModReason] = useState('');

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const selectedPlanAnalytics = selectedPlan ? getPlanAnalytics(selectedPlan.id) : null;
  const upcomingSchedule = selectedPlan ? generateUpcomingSchedule(selectedPlan, 5) : [];

  const filteredPlans = plans.filter((p) => {
    if (filterStatus === 'all') return true;
    return p.status === filterStatus;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newRecipient) return;

    let amountConfig: any = {
      type: newAmountType,
      baseAmount: Number(newBaseAmount),
      currency: newCurrency,
    };

    if (newAmountType === 'percentage_step') {
      amountConfig.percentageStep = {
        percentageChange: Number(newPercentageChange),
        stepFrequencyCycles: Number(newStepFrequency),
        compound: true,
      };
    } else if (newAmountType === 'tiered') {
      amountConfig.tieredAmounts = [
        { upToCycle: 2, amount: Number(newBaseAmount) },
        { upToCycle: 5, amount: roundAmount(Number(newBaseAmount) * 1.2) },
        { upToCycle: 10, amount: roundAmount(Number(newBaseAmount) * 1.5) },
      ];
    } else if (newAmountType === 'scheduled') {
      amountConfig.scheduledAmounts = [
        { cycle: 1, amount: Number(newBaseAmount) },
        { cycle: 2, amount: roundAmount(Number(newBaseAmount) * 1.1) },
        { cycle: 3, amount: roundAmount(Number(newBaseAmount) * 1.25) },
      ];
    }

    createPlan({
      title: newTitle,
      recipientAddress: newRecipient,
      payerAddress: newPayer || 'G...PayerSelf',
      startDate: Date.now(),
      maxCycles: newMaxCycles ? Number(newMaxCycles) : null,
      intervalConfig: {
        frequency: newFrequency,
        intervalCount: Number(newIntervalCount),
        customIntervalDays: newFrequency === 'custom' ? Number(newCustomDays) : undefined,
      },
      amountConfig,
    });

    setShowCreateModal(false);
    // Reset inputs
    setNewTitle('');
    setNewRecipient('');
  };

  const handleOpenModify = (plan: RecurringPaymentPlan) => {
    setModTitle(plan.title);
    setModBaseAmount(plan.amountConfig.baseAmount);
    setModMaxCycles(plan.maxCycles ?? undefined);
    setModReason('');
    setShowModifyModal(true);
  };

  const handleApplyModify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const updates: PlanModificationInput = {
      title: modTitle,
      amountConfig: {
        ...selectedPlan.amountConfig,
        baseAmount: Number(modBaseAmount),
      },
      maxCycles: modMaxCycles ? Number(modMaxCycles) : null,
    };

    modifyPlan(selectedPlan.id, updates, modReason || 'User plan adjustment');
    setShowModifyModal(false);
  };

  if (!isLoaded) {
    return (
      <div className="p-8 text-center text-gray-400">
        Loading recurring payment plans...
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Flexible Recurring Payment Plans
          </h1>
          <p className="text-sm text-gray-400">
            Create and manage recurring plans with customizable intervals, amounts, and pause controls.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition"
        >
          + Create New Plan
        </button>
      </div>

      {/* Portfolio Analytics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-4">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Active Plans
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {portfolioAnalytics.activePlans}
            </span>
            <span className="text-xs text-gray-400">
              of {portfolioAnalytics.totalPlans} total
            </span>
          </div>
        </div>

        <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-4">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Total Collected
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">
              {portfolioAnalytics.totalVolumeCollected.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">
              +{portfolioAnalytics.totalProjectedVolume.toLocaleString()} proj.
            </span>
          </div>
        </div>

        <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-4">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            On-Time Rate
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-400">
              {portfolioAnalytics.overallOnTimeRate}%
            </span>
            <span className="text-xs text-gray-400">
              {portfolioAnalytics.successfulExecutionsCount} execs
            </span>
          </div>
        </div>

        <div className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-4">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Missed Payments
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold ${
                portfolioAnalytics.totalMissedPayments > 0
                  ? 'text-rose-400'
                  : 'text-gray-300'
              }`}
            >
              {portfolioAnalytics.totalMissedPayments}
            </span>
            <span className="text-xs text-emerald-400">
              {portfolioAnalytics.totalMissedPayments === 0 ? 'All caught up' : 'Needs attention'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Plans List + Selected Plan Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Plan List */}
        <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-white">Your Plans</h2>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredPlans.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No plans found matching filter.
              </p>
            ) : (
              filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedPlanId === plan.id
                      ? 'bg-gray-800 border-indigo-500'
                      : 'bg-gray-800/40 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-gray-100">
                      {plan.title}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        plan.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : plan.status === 'paused'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-gray-400 flex justify-between">
                    <span>
                      {plan.intervalConfig.frequency}{' '}
                      {plan.intervalConfig.intervalCount > 1
                        ? `(every ${plan.intervalConfig.intervalCount})`
                        : ''}
                    </span>
                    <span className="font-mono text-gray-200">
                      {plan.amountConfig.baseAmount} {plan.amountConfig.currency} (
                      {plan.amountConfig.type})
                    </span>
                  </div>

                  <div className="mt-1 text-[11px] text-gray-500 flex justify-between">
                    <span>Cycle: {plan.currentCycle}</span>
                    <span>
                      {plan.executions.length} payments recorded
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Plan Detail */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedPlan ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
              Select a payment plan on the left to view details, execution schedule, pause controls, and analytics.
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
              {/* Plan Title & Actions Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">
                      {selectedPlan.title}
                    </h2>
                    <span
                      className={`text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                        selectedPlan.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : selectedPlan.status === 'paused'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {selectedPlan.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Recipient: <span className="font-mono">{selectedPlan.recipientAddress}</span>
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedPlan.status === 'active' && (
                    <button
                      onClick={() => pausePlan(selectedPlan.id, 'User paused from dashboard')}
                      className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded text-xs font-medium transition"
                    >
                      Pause Plan
                    </button>
                  )}

                  {selectedPlan.status === 'paused' && (
                    <div className="flex items-center gap-1">
                      <select
                        value={resumePolicy}
                        onChange={(e) => setResumePolicy(e.target.value as ResumeSchedulePolicy)}
                        className="bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded px-2 py-1.5"
                        title="Resume policy"
                      >
                        <option value="catch_up">Catch Up Missed</option>
                        <option value="shift_schedule">Shift Schedule</option>
                        <option value="next_scheduled_date">Next Full Interval</option>
                      </select>
                      <button
                        onClick={() => resumePlan(selectedPlan.id, resumePolicy)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
                      >
                        Resume Plan
                      </button>
                    </div>
                  )}

                  {selectedPlan.status !== 'completed' && selectedPlan.status !== 'cancelled' && (
                    <>
                      <button
                        onClick={() => handleOpenModify(selectedPlan)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded text-xs font-medium transition"
                      >
                        Modify
                      </button>
                      <button
                        onClick={() => cancelPlan(selectedPlan.id)}
                        className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded text-xs font-medium transition"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Execution / Schedule Action Controls */}
              {selectedPlan.status === 'active' && (
                <div className="p-4 bg-gray-800/40 border border-gray-800 rounded-lg flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <span className="text-xs text-gray-400">Next Scheduled Execution:</span>
                    <p className="text-sm font-semibold text-white">
                      {selectedPlan.nextExecutionDate
                        ? new Date(selectedPlan.nextExecutionDate).toLocaleDateString() + ' ' + new Date(selectedPlan.nextExecutionDate).toLocaleTimeString()
                        : 'None / Completed'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => executePlanPayment(selectedPlan.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition"
                    >
                      Execute Next Payment
                    </button>
                    <button
                      onClick={() => catchUpPlan(selectedPlan.id)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-medium transition"
                    >
                      Catch Up All Due Payments
                    </button>
                  </div>
                </div>
              )}

              {/* Single Plan Analytics Cards */}
              {selectedPlanAnalytics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700/50">
                    <span className="text-[11px] text-gray-400 uppercase">Paid Volume</span>
                    <p className="text-lg font-bold text-emerald-400">
                      {selectedPlanAnalytics.totalAmountPaid} {selectedPlan.amountConfig.currency}
                    </p>
                  </div>
                  <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700/50">
                    <span className="text-[11px] text-gray-400 uppercase">Avg Amount</span>
                    <p className="text-lg font-bold text-white">
                      {selectedPlanAnalytics.averagePaymentAmount} {selectedPlan.amountConfig.currency}
                    </p>
                  </div>
                  <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700/50">
                    <span className="text-[11px] text-gray-400 uppercase">Cycles</span>
                    <p className="text-lg font-bold text-indigo-400">
                      {selectedPlanAnalytics.completedCycles}
                      {selectedPlanAnalytics.totalCyclesPlanned ? ` / ${selectedPlanAnalytics.totalCyclesPlanned}` : ''}
                    </p>
                  </div>
                  <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700/50">
                    <span className="text-[11px] text-gray-400 uppercase">Times Paused</span>
                    <p className="text-lg font-bold text-amber-400">
                      {selectedPlanAnalytics.timesPaused}
                    </p>
                  </div>
                </div>
              )}

              {/* Upcoming Payment Schedule */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-200">
                  Upcoming Scheduled Payments (with Amount Variations)
                </h3>
                {upcomingSchedule.length === 0 ? (
                  <p className="text-xs text-gray-500">No upcoming payments scheduled.</p>
                ) : (
                  <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden">
                    {upcomingSchedule.map((item) => (
                      <div
                        key={item.cycle}
                        className="p-3 bg-gray-900/50 flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded font-mono">
                            Cycle {item.cycle}
                          </span>
                          <span className="text-gray-300">
                            {new Date(item.scheduledDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-emerald-400">
                            {item.amount} {item.currency}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              item.status === 'due'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Execution History */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-200">
                  Execution History ({selectedPlan.executions.length})
                </h3>
                {selectedPlan.executions.length === 0 ? (
                  <p className="text-xs text-gray-500">No executions recorded yet.</p>
                ) : (
                  <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {selectedPlan.executions.map((e) => (
                      <div
                        key={e.id}
                        className="p-3 bg-gray-900/50 flex justify-between items-center text-xs"
                      >
                        <div>
                          <span className="font-mono text-gray-300">Cycle {e.cycle}</span>
                          <span className="text-gray-500 ml-2">
                            {new Date(e.executedDate).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-emerald-400">
                            {e.amount} {e.currency}
                          </span>
                          <span className="text-[10px] bg-emerald-900/30 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                            {e.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modifications Audit Trail */}
              {selectedPlan.modifications.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-200">
                    Audit Trail ({selectedPlan.modifications.length} modifications)
                  </h3>
                  <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                    {selectedPlan.modifications.map((m) => (
                      <div key={m.id} className="p-2.5 bg-gray-900/50 text-xs space-y-1">
                        <div className="flex justify-between text-gray-400">
                          <span className="font-mono text-indigo-400">{m.field}</span>
                          <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-gray-300 text-[11px]">{m.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">Create Recurring Payment Plan</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Plan Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Creator Retainer, Monthly Subscription"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Recipient Address
                </label>
                <input
                  type="text"
                  required
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  placeholder="G..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Interval Frequency
                  </label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value as PlanFrequency)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom Days</option>
                  </select>
                </div>

                {newFrequency === 'custom' ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Interval Days
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newCustomDays}
                      onChange={(e) => setNewCustomDays(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Interval Multiplier
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newIntervalCount}
                      onChange={(e) => setNewIntervalCount(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Amount Variation
                  </label>
                  <select
                    value={newAmountType}
                    onChange={(e) => setNewAmountType(e.target.value as AmountVariationType)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage_step">Percentage Step (+X% per N cycles)</option>
                    <option value="tiered">Tiered (e.g. +20%, +50%)</option>
                    <option value="scheduled">Scheduled Custom Amounts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Base Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newBaseAmount}
                    onChange={(e) => setNewBaseAmount(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {newAmountType === 'percentage_step' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-800/40 rounded-lg border border-gray-800">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Percentage Change (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newPercentageChange}
                      onChange={(e) => setNewPercentageChange(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Every N Cycles
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newStepFrequency}
                      onChange={(e) => setNewStepFrequency(Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Max Cycles (optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={newMaxCycles ?? ''}
                  onChange={(e) => setNewMaxCycles(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Infinite if left blank"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modify Plan Modal */}
      {showModifyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">Modify Plan Safely</h3>
              <button
                onClick={() => setShowModifyModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyModify} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={modTitle}
                  onChange={(e) => setModTitle(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Base Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={modBaseAmount}
                  onChange={(e) => setModBaseAmount(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Max Cycles
                </label>
                <input
                  type="number"
                  min="1"
                  value={modMaxCycles ?? ''}
                  onChange={(e) => setModMaxCycles(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Modification Reason
                </label>
                <input
                  type="text"
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  placeholder="e.g. Rate adjustment agreed with recipient"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowModifyModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
                >
                  Apply Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
