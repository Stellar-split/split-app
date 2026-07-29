'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

interface DisconnectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  walletAddress?: string;
}

export default function DisconnectModal({
  open,
  onClose,
  onConfirm,
  walletAddress,
}: DisconnectModalProps) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : '';

  return (
    <Modal open={open} onClose={onClose} title="Disconnect Wallet">
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2">
            Are you sure you want to disconnect your wallet?
          </p>
          {truncatedAddress && (
            <p className="text-xs text-gray-500 dark:text-gray-500 break-all">
              Address: <code className="font-mono">{truncatedAddress}</code>
            </p>
          )}
          <p className="mt-3 text-sm font-medium text-amber-600 dark:text-amber-500">
            You'll need to reconnect to continue using the app.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={confirming}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
          >
            {confirming && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            Disconnect
          </button>
        </div>
      </div>
    </Modal>
  );
}
