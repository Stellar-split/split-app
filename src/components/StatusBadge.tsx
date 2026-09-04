"use client";

import { useState } from "react";
import { STATUS_CONFIG, type InvoiceStatus } from "@/lib/invoiceStatus";

interface Props {
  status: InvoiceStatus;
  size?: "sm" | "md" | "lg";
  description?: string;
}

const SIZE: Record<string, string> = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

/**
 * StatusBadge — colour-coded chip for every invoice state.
 * Consumes centralized STATUS_CONFIG from src/lib/invoiceStatus.ts
 */
export default function StatusBadge({ status, size = "md", description }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const tooltipText = description || config.description;

  return (
    <div className="relative inline-block">
      <span
        role="status"
        aria-label={`Status: ${status} — ${tooltipText}`}
        className={`inline-flex items-center gap-1 rounded-full font-semibold cursor-help ${SIZE[size]} ${config.colorClass}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        tabIndex={0}
      >
        {config.icon && <span aria-hidden="true">{config.icon}</span>}
        {config.label}
      </span>

      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap pointer-events-none z-10 shadow-lg"
          role="tooltip"
        >
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
