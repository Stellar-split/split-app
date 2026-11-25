"use client";

import { useState, useEffect, useCallback, useId } from "react";

type Denomination = "XLM" | "USDC";

interface AmountDenominationInputProps {
  /** The current amount string in the active denomination */
  value: string;
  /** Called with the new amount string (in the active denomination) on change */
  onChange: (value: string) => void;
  /** The current denomination ("XLM" | "USDC") */
  denomination: Denomination;
  /** Called when the denomination is switched */
  onDenominationChange: (denom: Denomination) => void;
  /** XLM/USDC exchange rate: 1 XLM = rate USDC. null = unavailable */
  xlmToUsdcRate: number | null;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Optional error message */
  error?: string;
  /** Input label */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
}

/**
 * AmountDenominationInput
 *
 * An amount input with an inline XLM / USDC toggle. When the user switches
 * denomination the current value is automatically converted using the live
 * exchange rate. If the rate is unavailable the field is cleared rather than
 * showing a stale converted value.
 */
export default function AmountDenominationInput({
  value,
  onChange,
  denomination,
  onDenominationChange,
  xlmToUsdcRate,
  disabled = false,
  error,
  label = "Amount",
  required = false,
}: AmountDenominationInputProps) {
  const inputId = useId();
  const convertedId = useId();

  // Compute the equivalent amount in the other denomination for the hint label
  const otherDenom: Denomination = denomination === "XLM" ? "USDC" : "XLM";
  const convertedAmount = (() => {
    if (!xlmToUsdcRate || !value || isNaN(parseFloat(value))) return null;
    const n = parseFloat(value);
    if (denomination === "XLM") {
      return (n * xlmToUsdcRate).toFixed(2);
    } else {
      return (n / xlmToUsdcRate).toFixed(7);
    }
  })();

  const handleToggle = useCallback(() => {
    const next: Denomination = denomination === "XLM" ? "USDC" : "XLM";

    if (!xlmToUsdcRate || !value || isNaN(parseFloat(value))) {
      // Can't convert — clear the value and switch denomination
      onDenominationChange(next);
      onChange("");
      return;
    }

    const n = parseFloat(value);
    let converted: number;
    if (denomination === "XLM") {
      converted = n * xlmToUsdcRate;
    } else {
      converted = n / xlmToUsdcRate;
    }

    // next === "USDC" means we just converted XLM -> USDC (2 decimals);
    // next === "XLM" means we just converted USDC -> XLM (7 decimals).
    const decimals = next === "USDC" ? 2 : 7;
    onDenominationChange(next);
    onChange(converted.toFixed(decimals));
  }, [denomination, value, xlmToUsdcRate, onDenominationChange, onChange]);

  const borderCls = error
    ? "border-red-500 focus-within:ring-red-500"
    : "border-gray-600 hover:border-gray-500 focus-within:ring-indigo-500";

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-200"
        >
          {label}
          {required && (
            <span className="ml-1 text-red-400" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {/* Input + toggle pill */}
      <div
        className={`flex items-stretch w-full min-h-11 rounded-lg border bg-gray-800 transition-colors focus-within:outline-none focus-within:ring-2 ${borderCls} overflow-hidden`}
      >
        <input
          id={inputId}
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          placeholder="0.0000000"
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${inputId}-error`
              : convertedAmount
              ? convertedId
              : undefined
          }
          className="flex-1 min-w-0 bg-transparent px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* Denomination toggle button */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          aria-label={`Switch to ${otherDenom}`}
          title={
            xlmToUsdcRate
              ? `Switch to ${otherDenom} (1 XLM ≈ ${xlmToUsdcRate.toFixed(4)} USDC)`
              : `Switch to ${otherDenom} (rate unavailable)`
          }
          className={[
            "flex items-center gap-1 shrink-0 px-3 py-2 border-l border-gray-600",
            "text-xs font-semibold tracking-wide transition-colors select-none",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
            disabled
              ? "cursor-not-allowed opacity-50 text-gray-500"
              : denomination === "XLM"
              ? "text-yellow-300 hover:bg-yellow-500/10 active:bg-yellow-500/20"
              : "text-blue-300 hover:bg-blue-500/10 active:bg-blue-500/20",
          ].join(" ")}
        >
          {/* Small currency icon */}
          <span
            className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
              denomination === "XLM"
                ? "bg-yellow-500/20 text-yellow-300"
                : "bg-blue-500/20 text-blue-300"
            }`}
            aria-hidden="true"
          >
            {denomination === "XLM" ? "✦" : "$"}
          </span>
          {denomination}
          {/* Swap arrows */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3 h-3 opacity-60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
        </button>
      </div>

      {/* Converted amount hint */}
      {convertedAmount && !error && (
        <p
          id={convertedId}
          className="text-xs text-gray-400"
          aria-live="polite"
        >
          ≈&nbsp;{convertedAmount}&nbsp;{otherDenom}
          {xlmToUsdcRate && (
            <span className="ml-1 opacity-60">
              (1&nbsp;XLM&nbsp;≈&nbsp;{xlmToUsdcRate.toFixed(4)}&nbsp;USDC)
            </span>
          )}
        </p>
      )}

      {/* Rate unavailable hint */}
      {!xlmToUsdcRate && !error && (
        <p className="text-xs text-gray-500">Rate unavailable — no auto-conversion</p>
      )}

      {/* Error */}
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
