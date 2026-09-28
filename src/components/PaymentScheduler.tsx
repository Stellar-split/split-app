"use client";

import { useState, useMemo, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PaymentFrequency = "one-time" | "weekly" | "biweekly" | "monthly";

export interface ScheduledInstalment {
  id: string;
  dueDate: string;      // ISO date string YYYY-MM-DD
  amount: number;       // in USDC
  label: string;
  status: "pending" | "paid" | "overdue";
}

export interface PaymentScheduleConfig {
  totalAmount: number;
  frequency: PaymentFrequency;
  instalments: number;
  startDate: string;    // YYYY-MM-DD
  token: "USDC" | "XLM";
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "stellarsplit_payment_schedules_v2";

interface SavedSchedule {
  invoiceId: string;
  config: PaymentScheduleConfig;
  instalments: ScheduledInstalment[];
  createdAt: string;
}

function loadSchedules(): SavedSchedule[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persistSchedule(schedule: SavedSchedule) {
  const all = loadSchedules().filter((s) => s.invoiceId !== schedule.invoiceId);
  all.push(schedule);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function removeSchedule(invoiceId: string) {
  const all = loadSchedules().filter((s) => s.invoiceId !== invoiceId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const FREQUENCY_DAYS: Record<PaymentFrequency, number> = {
  "one-time": 0,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  "one-time": "One-time",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

function buildInstalments(config: PaymentScheduleConfig): ScheduledInstalment[] {
  const { totalAmount, frequency, instalments, startDate } = config;
  const count = frequency === "one-time" ? 1 : instalments;
  const perInstalment = parseFloat((totalAmount / count).toFixed(2));
  const today = new Date().toISOString().split("T")[0];
  const intervalDays = FREQUENCY_DAYS[frequency];

  return Array.from({ length: count }, (_, i) => {
    const dueDate = i === 0 ? startDate : addDays(startDate, i * intervalDays);
    const status: ScheduledInstalment["status"] =
      dueDate < today ? "overdue" : "pending";
    return {
      id: `inst-${i + 1}`,
      dueDate,
      amount: i === count - 1 ? parseFloat((totalAmount - perInstalment * (count - 1)).toFixed(2)) : perInstalment,
      label: count === 1 ? "Full Payment" : `Instalment ${i + 1} of ${count}`,
      status,
    };
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ScheduledInstalment["status"] }) {
  const map = {
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    paid: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    overdue: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  invoiceId: string;
  /** Total invoice amount in USDC/XLM */
  totalAmount?: number;
  token?: "USDC" | "XLM";
  /** Called when user confirms a payment for an instalment */
  onPayInstalment?: (instalment: ScheduledInstalment) => void;
}

export default function PaymentScheduler({
  invoiceId,
  totalAmount: defaultAmount = 1000,
  token = "USDC",
  onPayInstalment,
}: Props) {
  // Check for existing saved schedule
  const existing = useMemo(() => {
    const saved = loadSchedules().find((s) => s.invoiceId === invoiceId);
    return saved ?? null;
  }, [invoiceId]);

  const [mode, setMode] = useState<"setup" | "active">(existing ? "active" : "setup");
  const [instalments, setInstalments] = useState<ScheduledInstalment[]>(existing?.instalments ?? []);
  const [savedConfig, setSavedConfig] = useState<PaymentScheduleConfig | null>(existing?.config ?? null);

  // Form state
  const [amount, setAmount] = useState(existing?.config.totalAmount ?? defaultAmount);
  const [frequency, setFrequency] = useState<PaymentFrequency>(existing?.config.frequency ?? "monthly");
  const [numInstalments, setNumInstalments] = useState(existing?.config.instalments ?? 3);
  const [startDate, setStartDate] = useState(existing?.config.startDate ?? todayStr());
  const [amountError, setAmountError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (amount <= 0) return [];
    return buildInstalments({
      totalAmount: amount,
      frequency,
      instalments: numInstalments,
      startDate,
      token,
    });
  }, [amount, frequency, numInstalments, startDate, token]);

  const handleCreate = useCallback(() => {
    if (amount <= 0) {
      setAmountError("Amount must be greater than 0");
      return;
    }
    setAmountError(null);
    const config: PaymentScheduleConfig = {
      totalAmount: amount,
      frequency,
      instalments: numInstalments,
      startDate,
      token,
    };
    const built = buildInstalments(config);
    persistSchedule({ invoiceId, config, instalments: built, createdAt: new Date().toISOString() });
    setSavedConfig(config);
    setInstalments(built);
    setMode("active");
  }, [amount, frequency, numInstalments, startDate, token, invoiceId]);

  const handleMarkPaid = useCallback(
    (id: string) => {
      setInstalments((prev) => {
        const updated = prev.map((inst) =>
          inst.id === id ? { ...inst, status: "paid" as const } : inst
        );
        if (savedConfig) {
          persistSchedule({
            invoiceId,
            config: savedConfig,
            instalments: updated,
            createdAt: new Date().toISOString(),
          });
        }
        const inst = updated.find((i) => i.id === id);
        if (inst) onPayInstalment?.(inst);
        return updated;
      });
    },
    [invoiceId, savedConfig, onPayInstalment]
  );

  const handleReset = useCallback(() => {
    removeSchedule(invoiceId);
    setMode("setup");
    setInstalments([]);
    setSavedConfig(null);
  }, [invoiceId]);

  const paidCount = instalments.filter((i) => i.status === "paid").length;
  const paidAmount = instalments.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const progressPct = instalments.length > 0 ? Math.round((paidCount / instalments.length) * 100) : 0;

  // ── Setup view ───────────────────────────────────────────────────────────────
  if (mode === "setup") {
    return (
      <section
        aria-labelledby="payment-scheduler-heading"
        className="bg-gray-900 border border-gray-800 rounded-2xl p-5"
      >
        <h2 id="payment-scheduler-heading" className="text-base font-semibold text-white mb-4">
          Pay Over Time — Schedule Payments
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {/* Total Amount */}
          <div className="flex flex-col gap-1">
            <label htmlFor="sched-amount" className="text-xs text-gray-400 font-medium">
              Total Amount ({token})
            </label>
            <input
              id="sched-amount"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => {
                setAmount(parseFloat(e.target.value) || 0);
                setAmountError(null);
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {amountError && <p className="text-xs text-red-400">{amountError}</p>}
          </div>

          {/* Frequency */}
          <div className="flex flex-col gap-1">
            <label htmlFor="sched-frequency" className="text-xs text-gray-400 font-medium">
              Payment Frequency
            </label>
            <select
              id="sched-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as PaymentFrequency)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(Object.keys(FREQUENCY_LABELS) as PaymentFrequency[]).map((f) => (
                <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
              ))}
            </select>
          </div>

          {/* Number of instalments */}
          {frequency !== "one-time" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="sched-instalments" className="text-xs text-gray-400 font-medium">
                Number of Instalments
              </label>
              <input
                id="sched-instalments"
                type="number"
                min={2}
                max={24}
                step={1}
                value={numInstalments}
                onChange={(e) => setNumInstalments(Math.max(2, Math.min(24, parseInt(e.target.value) || 2)))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Start date */}
          <div className="flex flex-col gap-1">
            <label htmlFor="sched-start" className="text-xs text-gray-400 font-medium">
              First Payment Date
            </label>
            <input
              id="sched-start"
              type="date"
              value={startDate}
              min={todayStr()}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mb-5">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2">
              Schedule Preview
            </p>
            <ul className="space-y-2">
              {preview.map((inst) => (
                <li
                  key={inst.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <span className="text-gray-300 font-medium">{inst.label}</span>
                    <span className="text-gray-500 text-xs ml-2">
                      {new Date(inst.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <span className="font-semibold text-indigo-300">
                    {inst.amount.toLocaleString()} {token}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={handleCreate}
          className="w-full min-h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Create Schedule
        </button>
      </section>
    );
  }

  // ── Active schedule view ─────────────────────────────────────────────────────
  return (
    <section
      aria-labelledby="payment-scheduler-active-heading"
      className="bg-gray-900 border border-gray-800 rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 id="payment-scheduler-active-heading" className="text-base font-semibold text-white">
            Payment Schedule
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {FREQUENCY_LABELS[savedConfig?.frequency ?? "one-time"]} · {token}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors focus:outline-none focus:underline"
        >
          Reset
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span>{paidCount} of {instalments.length} paid</span>
          <span className="font-semibold text-white">
            {paidAmount.toLocaleString()} / {savedConfig?.totalAmount.toLocaleString()} {token}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-800 overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1 text-right">{progressPct}% complete</p>
      </div>

      {/* Instalment list */}
      <ul className="space-y-3">
        {instalments.map((inst) => (
          <li
            key={inst.id}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
              inst.status === "paid"
                ? "bg-gray-800/50 border-gray-700/50 opacity-60"
                : inst.status === "overdue"
                ? "bg-red-500/5 border-red-500/20"
                : "bg-gray-800 border-gray-700"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{inst.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Due{" "}
                {new Date(inst.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-sm font-semibold text-indigo-300">
                  {inst.amount.toLocaleString()} {token}
                </p>
                <StatusPill status={inst.status} />
              </div>
              {inst.status !== "paid" && (
                <button
                  type="button"
                  onClick={() => handleMarkPaid(inst.id)}
                  className="min-h-8 px-3 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Pay
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {paidCount === instalments.length && instalments.length > 0 && (
        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
          <p className="text-sm font-semibold text-emerald-400">🎉 All instalments paid!</p>
        </div>
      )}
    </section>
  );
}
