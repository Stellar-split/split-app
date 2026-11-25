"use client";

/**
 * RangeSlider — accessible percentage slider built on a native <input type="range">.
 *
 * Native range inputs already give us arrow-key stepping, Home/End, and the
 * correct ARIA slider semantics for free, so this is purely a styling and
 * value-coercion wrapper. `step` defaults to 1 so Up/Down/Left/Right move in
 * whole-percent increments; callers that need finer precision (e.g. the
 * "Equalize Shares" action producing 33.3333%) keep a paired number input.
 */
interface RangeSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel: string;
  /** Rendered by assistive tech instead of the raw number, e.g. "42%". */
  ariaValueText?: string;
  id?: string;
  className?: string;
}

export default function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  ariaLabel,
  ariaValueText,
  id,
  className = "",
}: RangeSliderProps) {
  const safeValue = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  const fillPercent = max === min ? 0 : ((safeValue - min) / (max - min)) * 100;

  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={safeValue}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${fillPercent}%, #374151 ${fillPercent}%, #374151 100%)`,
      }}
      className={`h-2 w-full cursor-pointer appearance-none rounded-full outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:shadow ${className}`}
    />
  );
}
