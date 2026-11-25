'use client';

import { useMemo, useState } from 'react';
import { z } from 'zod';

export interface InstallmentMilestone {
  id: string;
  amount: number;
  dueDate: number;
  status: 'upcoming' | 'overdue' | 'paid';
  txHash?: string;
}

const MilestoneSchema = z.object({
  id: z.string().min(1, 'ID required'),
  amount: z.number().min(0, 'Amount must be >= 0'),
  dueDate: z.number().min(0, 'Valid date required'),
  status: z.enum(['upcoming', 'overdue', 'paid']),
  txHash: z.string().optional(),
});

interface Props {
  totalAmount: number;
  installments: InstallmentMilestone[];
  assetCode: 'XLM' | 'USDC';
  onChange: (milestones: InstallmentMilestone[]) => void;
}

const STEPS = ['amount', 'schedule'] as const;

const DAY_SECONDS = 86400;

/** Formats a numeric amount with up to 7 decimal places, trimming trailing zeros. */
function formatPlanAmount(value: number): string {
  return Number(value.toFixed(7)).toString();
}

/** Converts a unix timestamp (seconds) to a `datetime-local` input value. */
function toDateTimeLocal(ts: number): string {
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Builds and validates an installment payment plan: milestone amounts, due-date
 * schedule, custom terms and a plan summary before saving.
 */
export default function InstallmentPlanBuilder({ totalAmount, installments, assetCode, onChange }: Props) {
  const [localMilestones, setLocalMilestones] = useState<InstallmentMilestone[]>(installments);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [termDays, setTermDays] = useState(30);

  const sum = useMemo(
    () => localMilestones.reduce((s, m) => s + (Number(m.amount) || 0), 0),
    [localMilestones]
  );

  const delta = Math.abs(sum - totalAmount);

  const validate = (): boolean => {
    const parsed = z.array(MilestoneSchema).safeParse(localMilestones);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return false;
    }
    if (localMilestones.length === 0) {
      setErrors(['Add at least one milestone']);
      return false;
    }
    if (delta >= 0.0001) {
      setErrors([
        `Milestone amounts must sum to ${totalAmount.toFixed(7)} ${assetCode} (current sum: ${sum.toFixed(7)})`,
      ]);
      return false;
    }
    setErrors([]);
    onChange(localMilestones);
    return true;
  };

  const addMilestone = () => {
    const nextId = `ms_${Date.now()}_${localMilestones.length}`;
    const lastDue = localMilestones.length > 0 ? localMilestones[localMilestones.length - 1].dueDate + DAY_SECONDS : Math.floor(Date.now() / 1000) + DAY_SECONDS;
    setLocalMilestones([...localMilestones, {
      id: nextId,
      amount: localMilestones.length === 0 ? Number(totalAmount.toFixed(7)) : 0,
      dueDate: lastDue,
      status: 'upcoming',
    }]);
  };

  /** Recalculates due dates evenly across the plan term, starting one term from now. */
  const applySchedule = () => {
    const count = localMilestones.length;
    if (count === 0) return;
    const start = Math.floor(Date.now() / 1000);
    const interval = Math.max(1, Math.round((termDays * DAY_SECONDS) / count));
    setLocalMilestones((prev) =>
      prev.map((m, i) => ({ ...m, dueDate: start + interval * (i + 1) }))
    );
  };

  /** Splits the total amount evenly across the current milestones. */
  const splitEvenly = () => {
    const count = localMilestones.length;
    if (count === 0) return;
    const base = Math.floor((totalAmount / count) * 1e7) / 1e7;
    setLocalMilestones((prev) =>
      prev.map((m, i) => ({
        ...m,
        amount: i === count - 1 ? Number((totalAmount - base * (count - 1)).toFixed(7)) : base,
      }))
    );
  };

  const removeMilestone = (idx: number) => {
    setLocalMilestones(localMilestones.filter((_, i) => i !== idx));
  };

  const updateMilestone = (idx: number, patch: Partial<InstallmentMilestone>) => {
    setLocalMilestones((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, ...patch } : m))
    );
  };

  const moveMilestone = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= localMilestones.length) return;
    setLocalMilestones((prev) => {
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleNext = () => {
    if (step === 0 && !validate()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-950 border border-red-800 p-3">
          {errors.map((e, i) => (
            <p key={i} role="alert" className="text-red-400 text-sm">{e}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 mb-2" aria-label="Builder steps">
        {STEPS.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { if (i <= step || validate()) setStep(i); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              i === step ? 'bg-indigo-600 text-white' : i < step ? 'bg-indigo-900/50 text-indigo-300' : 'bg-gray-800 text-gray-400'
            }`}
            aria-current={i === step ? 'step' : undefined}
          >
            {label === 'amount' ? 'Amounts' : 'Schedule'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Milestones</span>
              <button type="button" onClick={addMilestone} className="min-h-9 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                Add Milestone
              </button>
            </div>
            {localMilestones.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={splitEvenly} className="min-h-9 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors">
                  Split Evenly
                </button>
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  Term (days)
                  <input
                    type="number"
                    min="1"
                    value={termDays}
                    onChange={(e) => setTermDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 min-h-9 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Plan term in days"
                  />
                </label>
                <button type="button" onClick={applySchedule} className="min-h-9 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors">
                  Recalculate Schedule
                </button>
              </div>
            )}
            {localMilestones.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No milestones yet. Add one to break this invoice into installments.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {localMilestones.map((m, idx) => (
                  <div key={m.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 p-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-mono text-gray-500 shrink-0">#{idx + 1}</span>
                      <input
                        type="number"
                        step="0.0000001"
                        min="0"
                        value={m.amount === 0 ? '' : m.amount}
                        onChange={(e) => updateMilestone(idx, { amount: parseFloat(e.target.value) || 0 })}
                        className="w-full sm:w-28 min-h-9 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label={`Milestone ${idx + 1} amount`}
                      />
                      <span className="text-xs text-gray-500">{assetCode}</span>
                    </div>
                    <div className="flex items-center gap-1 pl-8 sm:pl-0">
                      <button type="button" onClick={() => moveMilestone(idx, -1)} disabled={idx === 0} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-40 text-xs" aria-label="Move up">↑</button>
                      <button type="button" onClick={() => moveMilestone(idx, 1)} disabled={idx === localMilestones.length - 1} className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-40 text-xs" aria-label="Move down">↓</button>
                      <button type="button" onClick={() => removeMilestone(idx)} className="p-1.5 rounded bg-red-900 hover:bg-red-800 text-red-300 text-xs" aria-label="Remove milestone">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Total: {formatPlanAmount(sum)} {assetCode}</span>
              <span className={delta < 0.0001 ? 'text-green-400' : 'text-red-400'}>
                {delta < 0.0001 ? '✓ Matches total' : `Δ ${delta.toFixed(7)}`}
              </span>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-gray-300">Due dates</span>
            {localMilestones.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No milestones to schedule.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {localMilestones.map((m, idx) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 p-3">
                    <span className="text-xs font-mono text-gray-500 shrink-0">#{idx + 1}</span>
                    <label className="text-sm text-gray-400 shrink-0">Due</label>
                    <input
                      type="datetime-local"
                      value={toDateTimeLocal(m.dueDate)}
                      onChange={(e) => {
                        const ts = Math.floor(new Date(e.target.value).getTime() / 1000);
                        updateMilestone(idx, { dueDate: ts > 0 ? ts : 0 });
                      }}
                      className="flex-1 min-h-9 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      aria-label={`Milestone ${idx + 1} due date`}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg bg-gray-800 border border-gray-700 p-3 text-xs text-gray-400" aria-label="Plan summary">
              <p className="text-sm font-medium text-gray-300 mb-1">Plan summary</p>
              <p>{localMilestones.length} installment{localMilestones.length === 1 ? '' : 's'} · {formatPlanAmount(sum)} / {formatPlanAmount(totalAmount)} {assetCode}</p>
              <p>
                {localMilestones.length > 0 && localMilestones[0].dueDate > 0
                  ? `First due ${new Date(localMilestones[0].dueDate * 1000).toLocaleDateString()}`
                  : 'No due date set'}
                {localMilestones.length > 1 && localMilestones[localMilestones.length - 1].dueDate > 0
                  ? ` · Last due ${new Date(localMilestones[localMilestones.length - 1].dueDate * 1000).toLocaleDateString()}`
                  : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {step > 0 && (
            <button type="button" onClick={handleBack} className="min-h-11 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 font-medium text-white transition-colors">
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={step === STEPS.length - 1 ? validate : handleNext}
            className="min-h-11 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            {step === STEPS.length - 1 ? 'Save Plan' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
