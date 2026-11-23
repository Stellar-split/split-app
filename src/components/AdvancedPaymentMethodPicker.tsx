"use client";

import { useRef } from "react";

export type PaymentMethodId = "freighter" | "batch" | "crossChain" | "confidential";

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  /** Estimated network fee, e.g. "~0.00001 XLM". */
  fee: string;
  /** Estimated settlement time, e.g. "~5s". */
  eta: string;
  recommended?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "freighter",
    label: "Freighter wallet",
    description: "Pay directly in USDC from your connected Stellar wallet.",
    fee: "~0.00001 XLM",
    eta: "~5s",
    recommended: true,
  },
  {
    id: "batch",
    label: "Batch payment",
    description: "Queue this payment with others and settle them in one transaction.",
    fee: "Shared",
    eta: "On submit",
  },
  {
    id: "crossChain",
    label: "Cross-chain bridge",
    description: "Pay from another chain; funds are bridged to Stellar USDC.",
    fee: "Bridge fee",
    eta: "~2–10 min",
  },
  {
    id: "confidential",
    label: "Confidential payment",
    description: "Hide the contributed amount from other participants.",
    fee: "~0.0001 XLM",
    eta: "~10s",
  },
];

/** A single payment contribution from one method. */
export interface PaymentContribution {
  method: PaymentMethodId;
  /** Amount in the smallest unit (e.g. stroops) to keep aggregation exact. */
  amount: number;
  /** Optional fee in the smallest unit; defaults to 0. */
  fee?: number;
}

/** Aggregated totals for a single payment method. */
export interface MethodAggregate {
  method: PaymentMethodId;
  count: number;
  amount: number;
  fee: number;
}

/** Consolidated aggregation across all payment methods. */
export interface PaymentAggregation {
  byMethod: MethodAggregate[];
  totalAmount: number;
  totalFee: number;
  netAmount: number;
  count: number;
}

/**
 * Aggregate payments across multiple methods, grouping by method and
 * consolidating totals. Methods with no contributions are omitted.
 */
export function aggregatePayments(contributions: PaymentContribution[]): PaymentAggregation {
  const groups = new Map<PaymentMethodId, MethodAggregate>();
  for (const c of contributions) {
    const amount = Number.isFinite(c.amount) ? c.amount : 0;
    const fee = Number.isFinite(c.fee) ? (c.fee as number) : 0;
    const existing = groups.get(c.method);
    if (existing) {
      existing.count += 1;
      existing.amount += amount;
      existing.fee += fee;
    } else {
      groups.set(c.method, { method: c.method, count: 1, amount, fee });
    }
  }

  const byMethod = Array.from(groups.values());
  const totalAmount = byMethod.reduce((sum, g) => sum + g.amount, 0);
  const totalFee = byMethod.reduce((sum, g) => sum + g.fee, 0);
  const count = byMethod.reduce((sum, g) => sum + g.count, 0);

  return {
    byMethod,
    totalAmount,
    totalFee,
    netAmount: totalAmount - totalFee,
    count,
  };
}

interface Props {
  value: PaymentMethodId | null;
  onChange: (id: PaymentMethodId) => void;
  methods?: PaymentMethodOption[];
  /** Optional contributions to render a consolidated aggregation summary. */
  contributions?: PaymentContribution[];
}

export default function AdvancedPaymentMethodPicker({
  value,
  onChange,
  methods = DEFAULT_PAYMENT_METHODS,
  contributions,
}: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = methods.map((m, i) => (m.disabled ? -1 : i)).filter((i) => i >= 0);
  const focusIndex = Math.max(
    methods.findIndex((m) => m.id === value && !m.disabled),
    enabled[0] ?? 0
  );
  const aggregation = contributions && contributions.length > 0 ? aggregatePayments(contributions) : null;

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const dir =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir || enabled.length === 0) return;
    e.preventDefault();
    const pos = enabled.indexOf(index);
    const next = enabled[(pos + dir + enabled.length) % enabled.length];
    refs.current[next]?.focus();
    onChange(methods[next].id);
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {methods.map((m, i) => {
          const selected = value === m.id;
          return (
            <button
              key={m.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={m.disabled || undefined}
              disabled={m.disabled}
              tabIndex={i === focusIndex ? 0 : -1}
              onClick={() => onChange(m.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`text-left rounded-xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                selected ? "border-indigo-500 bg-indigo-500/10" : "border-gray-700 bg-gray-900 hover:border-gray-500"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{m.label}</span>
                {m.recommended && (
                  <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">{m.description}</p>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span>Fee: {m.fee}</span>
                <span>Time: {m.eta}</span>
              </div>
              {m.disabled && m.disabledReason && (
                <p className="text-xs text-amber-300 mt-2">{m.disabledReason}</p>
              )}
            </button>
          );
        })}
      </div>

      {aggregation && (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4" aria-label="Payment aggregation summary">
          <h3 className="text-sm font-medium text-gray-200">Aggregated payments</h3>
          <ul className="mt-2 space-y-1 text-xs text-gray-400">
            {aggregation.byMethod.map((g) => (
              <li key={g.method} className="flex justify-between gap-2">
                <span>{methods.find((m) => m.id === g.method)?.label ?? g.method}</span>
                <span>
                  {g.count} × {g.amount} (fee {g.fee})
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between gap-2 border-t border-gray-700 pt-2 text-xs text-gray-300">
            <span>Total: {aggregation.totalAmount}</span>
            <span>Fees: {aggregation.totalFee}</span>
            <span>Net: {aggregation.netAmount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
