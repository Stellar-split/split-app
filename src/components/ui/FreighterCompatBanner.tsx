'use client';

import React, { useState, useEffect } from 'react';
import { useFreighterCompatibility, dismissFreighterCompatBanner } from '@/hooks/useFreighterCompatibility';
import { FREIGHTER_UPGRADE_URL } from '@/lib/freighterCompat';

interface FreighterCompatBannerProps {
  showOnlyOnError?: boolean;
}

export default function FreighterCompatBanner({
  showOnlyOnError = false,
}: FreighterCompatBannerProps) {
  const compatState = useFreighterCompatibility();
  const [isLocallyDismissed, setIsLocallyDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in session
    if (compatState.isDismissed) {
      setIsLocallyDismissed(true);
    }
  }, [compatState.isDismissed]);

  if (compatState.isLoading) {
    return null;
  }

  // Hide banner if:
  // 1. Already dismissed
  // 2. showOnlyOnError is true and status is compatible
  // 3. Status is unknown and showOnlyOnError is true
  if (
    isLocallyDismissed ||
    (showOnlyOnError && (compatState.status === 'compatible' || compatState.status === 'unknown'))
  ) {
    return null;
  }

  const handleDismiss = () => {
    setIsLocallyDismissed(true);
    dismissFreighterCompatBanner();
  };

  const getAlertStyles = () => {
    switch (compatState.status) {
      case 'unsupported':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          icon: '⚠️',
        };
      case 'deprecated':
        return {
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-800',
          icon: '⚡',
        };
      default:
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          icon: 'ℹ️',
        };
    }
  };

  const styles = getAlertStyles();

  return (
    <div
      className={`
        ${styles.bgColor} ${styles.borderColor}
        border rounded-lg p-4 mb-4 flex items-start gap-4
        ${styles.textColor}
      `}
      role="alert"
    >
      <div className="flex-shrink-0 text-xl">{styles.icon}</div>

      <div className="flex-1">
        <h3 className="font-semibold mb-1">Freighter Wallet</h3>
        <p className="text-sm mb-2">{compatState.message}</p>

        {compatState.breakingChange && (
          <details className="text-sm mt-2">
            <summary className="cursor-pointer font-medium">View breaking changes</summary>
            <pre className="mt-2 p-2 bg-black bg-opacity-5 rounded text-xs overflow-auto">
              {compatState.breakingChange}
            </pre>
          </details>
        )}

        {compatState.status === 'unsupported' && (
          <div className="mt-3">
            <a
              href={FREIGHTER_UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
            >
              Upgrade Freighter on Chrome Web Store
            </a>
          </div>
        )}

        {compatState.status === 'deprecated' && (
          <div className="mt-3">
            <a
              href={FREIGHTER_UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition-colors"
            >
              Upgrade Freighter
            </a>
          </div>
        )}
      </div>

      {compatState.canContinue && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
