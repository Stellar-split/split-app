'use client';

import { useState } from 'react';

const STATUS_CONFIG = {
  Pending: { icon: '⏳', label: 'Pending', color: 'yellow' },
  Funded: { icon: '✅', label: 'Funded', color: 'green' },
  Released: { icon: '🚀', label: 'Released', color: 'blue' },
  Refunded: { icon: '↩️', label: 'Refunded', color: 'gray' },
  Disputed: { icon: '⚠️', label: 'Disputed', color: 'red' },
};

export default function StatusBadge({ status = 'Pending', size = 'md', description }: any) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!config) return null;

  return (
    <div className={`status-badge status-badge--${size}`} onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <span>{config.icon} {config.label}</span>
      {showTooltip && description && <div className="tooltip">{description}</div>}
    </div>
  );
}
