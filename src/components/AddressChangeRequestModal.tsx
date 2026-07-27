'use client';

import { useState } from 'react';
import type { AddressChangeRequestInput } from '@/types/addressChangeRequest';

interface AddressChangeRequestModalProps {
  invoiceId: string;
  currentAddress: string;
  onSubmit: (request: AddressChangeRequestInput) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export default function AddressChangeRequestModal({
  invoiceId,
  currentAddress,
  onSubmit,
  onClose,
  isLoading = false,
}: AddressChangeRequestModalProps) {
  const [formData, setFormData] = useState<AddressChangeRequestInput>({
    oldAddress: currentAddress,
    newAddress: '',
    justification: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate new address is different from old address
    if (formData.newAddress === formData.oldAddress) {
      setError('New address must be different from current address');
      return;
    }

    // Validate new address format (basic check for Stellar address)
    if (!formData.newAddress.startsWith('G') || formData.newAddress.length !== 56) {
      setError('Invalid Stellar address format');
      return;
    }

    // Validate justification is provided
    if (!formData.justification.trim()) {
      setError('Please provide a justification for the address change');
      return;
    }

    try {
      await onSubmit(formData);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit address change request');
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-md w-full text-center">
          <div className="mb-4 text-3xl">✅</div>
          <h2 className="text-xl font-semibold text-white mb-2">Request Submitted</h2>
          <p className="text-gray-400 text-sm">
            Your address change request has been submitted to the invoice creator for review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold text-white mb-4">Request Address Change</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Old Address (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Current Address
            </label>
            <input
              type="text"
              value={formData.oldAddress}
              disabled
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
            />
          </div>

          {/* New Address */}
          <div>
            <label htmlFor="newAddress" className="block text-sm font-medium text-gray-300 mb-1">
              New Address *
            </label>
            <input
              id="newAddress"
              type="text"
              name="newAddress"
              value={formData.newAddress}
              onChange={handleChange}
              placeholder="G..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Must be a valid Stellar address starting with G</p>
          </div>

          {/* Justification */}
          <div>
            <label htmlFor="justification" className="block text-sm font-medium text-gray-300 mb-1">
              Reason for Change *
            </label>
            <textarea
              id="justification"
              name="justification"
              value={formData.justification}
              onChange={handleChange}
              placeholder="E.g., New wallet, updated address..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              required
            />
          </div>

          {/* Error message */}
          {error && <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">{error}</div>}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
