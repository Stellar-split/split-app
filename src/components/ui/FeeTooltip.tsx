'use client';

import React, { useState, useRef, useEffect } from 'react';

interface FeeBreakdown {
  baseFee: { stroops: number; xlm: number };
  resourceFee: { stroops: number; xlm: number };
  total: { stroops: number; xlm: number };
}

interface FeeTooltipProps {
  feeBreakdown: FeeBreakdown | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  children: React.ReactElement;
}

export default function FeeTooltip({
  feeBreakdown,
  isLoading = false,
  error = null,
  onRefresh,
  children,
}: FeeTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-label="Show fee breakdown"
        aria-expanded={isOpen}
        className="cursor-help"
      >
        {children}
      </div>

      {isOpen && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">Fee Breakdown</h3>
            {onRefresh && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                aria-label="Refresh fee breakdown"
                className="p-1 hover:bg-gray-700 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-sm text-gray-400">Loading fee data...</div>
          ) : error ? (
            <div className="text-sm text-red-400">{error}</div>
          ) : feeBreakdown ? (
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Base Fee</td>
                  <td className="py-2 text-right text-gray-300">
                    <span className="font-mono text-xs">{feeBreakdown.baseFee.stroops} stroops</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">Resource Fee</td>
                  <td className="py-2 text-right text-gray-300">
                    <span className="font-mono text-xs">{feeBreakdown.resourceFee.stroops} stroops</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-300 font-semibold">Total Fee</td>
                  <td className="py-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-indigo-300 font-mono">
                        {feeBreakdown.total.stroops} stroops
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {feeBreakdown.total.xlm.toFixed(7)} XLM
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-gray-400">Fee breakdown unavailable</div>
          )}
        </div>
      )}
    </div>
  );
}
