'use client';

import { useState } from 'react';
import { STATUS_CONFIG } from '@/lib/invoiceStatus';

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
} as const;

const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  gray: 'bg-gray-500/20 text-gray-400',
};

export interface StatusBadgeProps {
  status?: string;
  size?: keyof typeof SIZE_CLASSES;
  description?: string;
}

/**
 * StatusBadge — presentational pill showing an invoice status with an icon,
 * a colour-coded background, and an accessible tooltip on hover/focus.
 */
export default function StatusBadge({ status = 'Pending', size = 'md', description }: StatusBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const tooltipText = description ?? config.description;
  const colorClasses = COLOR_CLASSES[config.color] ?? COLOR_CLASSES.gray;

  return (
    <div
      role="status"
      tabIndex={0}
      aria-label={`Status: ${config.label} — ${tooltipText}`}
      className={`inline-flex items-center gap-1 rounded-full font-medium ${SIZE_CLASSES[size]} ${colorClasses}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
      {showTooltip && tooltipText && (
        <div role="tooltip" className="absolute mt-8 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow">
          {tooltipText}
        </div>
      )}
    </div>
  );
}
