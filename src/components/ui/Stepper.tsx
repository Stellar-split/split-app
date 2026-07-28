"use client";

import { Check, Circle, Dot } from "lucide-react";

export type StepStatus = "complete" | "current" | "upcoming";

export interface Step {
  label: string;
  status: StepStatus;
}

export interface StepperProps {
  steps: Step[];
  /**
   * Called when a user activates a *completed* step. Omit to render a
   * non-interactive trail.
   */
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Horizontal progress trail for multi-section forms.
 *
 * Desktop renders the full labelled trail; below `md` it collapses to a
 * "Step 2 of 4 — Recipients" summary line so the indicator never wraps on
 * narrow viewports.
 */
export default function Stepper({ steps, onStepClick, className = "" }: StepperProps) {
  if (steps.length === 0) return null;

  const currentIndex = steps.findIndex((s) => s.status === "current");
  // Fall back to the last step when every step is complete, so the mobile
  // summary still reads sensibly at the end of the flow.
  const activeIndex = currentIndex === -1 ? steps.length - 1 : currentIndex;
  const activeStep = steps[activeIndex];

  return (
    <nav
      aria-label={`Progress: ${steps.map((s) => s.label).join(", ")}`}
      className={className}
    >
      {/* Mobile: collapsed summary */}
      <p className="md:hidden text-sm font-medium text-gray-300">
        Step {activeIndex + 1} of {steps.length} — {activeStep.label}
      </p>

      {/* Desktop: full trail */}
      <ol className="hidden md:flex items-center gap-2" role="list">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const clickable = step.status === "complete" && !!onStepClick;

          return (
            <li key={step.label} className="flex items-center gap-2 flex-1 last:flex-none min-w-0">
              <StepMarker
                step={step}
                index={index}
                clickable={clickable}
                onClick={clickable ? () => onStepClick!(index) : undefined}
              />
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 min-w-4 ${
                    step.status === "complete" ? "bg-indigo-500" : "bg-gray-700"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepMarker({
  step,
  index,
  clickable,
  onClick,
}: {
  step: Step;
  index: number;
  clickable: boolean;
  onClick?: () => void;
}) {
  const Icon = step.status === "complete" ? Check : step.status === "current" ? Circle : Dot;

  const iconClass =
    step.status === "complete"
      ? "bg-indigo-600 border-indigo-500 text-white"
      : step.status === "current"
      ? "border-indigo-400 text-indigo-300"
      : "border-gray-700 text-gray-500";

  const labelClass =
    step.status === "upcoming" ? "text-gray-500" : "text-gray-200";

  const content = (
    <>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${iconClass}`}
      >
        <Icon
          aria-hidden="true"
          className="h-3.5 w-3.5"
          {...(step.status === "current" ? { fill: "currentColor" } : {})}
        />
      </span>
      <span className={`text-sm font-medium whitespace-nowrap ${labelClass}`}>
        {step.label}
      </span>
    </>
  );

  // `aria-current="step"` marks the active step for assistive tech; completed
  // steps stay reachable as buttons so users can jump back.
  const shared = {
    "aria-current": (step.status === "current" ? "step" : undefined) as "step" | undefined,
  };

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Go back to step ${index + 1}: ${step.label}`}
        className="flex items-center gap-2 rounded-lg px-1 py-1 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        {...shared}
      >
        {content}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 px-1 py-1" {...shared}>
      {content}
    </span>
  );
}
