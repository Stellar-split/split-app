"use client";

import { useState, useEffect } from "react";
import { SimulationResult } from "@/lib/simulateTx";

interface TxSimulationPreviewProps {
  isOpen: boolean;
  isLoading: boolean;
  simulationResult: SimulationResult | null;
  error: string | null;
  onProceed: () => void;
  onCancel: () => void;
  onSkip: () => void;
}

export default function TxSimulationPreview({
  isOpen,
  isLoading,
  simulationResult,
  error,
  onProceed,
  onCancel,
  onSkip,
}: TxSimulationPreviewProps) {
  if (!isOpen) return null;

  const isSimulationSuccess = simulationResult?.success === true;
  const hasSimulationError = simulationResult?.error || error;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Transaction Preview</h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : hasSimulationError ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">Simulation Unavailable</p>
              <p className="text-xs text-yellow-700">
                {simulationResult?.error || error}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              You can still proceed to sign the transaction directly in your wallet, or cancel to revise.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onSkip}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
              >
                Proceed Anyway
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isSimulationSuccess ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isSimulationSuccess ? "text-green-700" : "text-red-700"
                }`}
              >
                {isSimulationSuccess ? "Simulation Successful" : "Simulation Failed"}
              </span>
            </div>

            {/* Fee Display */}
            {simulationResult?.fee !== undefined && (
              <div className="border-t pt-3">
                <p className="text-xs text-gray-600 mb-1">Estimated Fee</p>
                <p className="text-lg font-semibold">{simulationResult.fee} stroops</p>
              </div>
            )}

            {/* Effects */}
            {simulationResult?.effects && simulationResult.effects.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs text-gray-600 mb-2">Affected Accounts</p>
                <div className="space-y-2">
                  {simulationResult.effects.map((effect, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded text-xs">
                      <p className="font-mono text-gray-700 truncate">
                        {effect.accountId}
                      </p>
                      <p className="text-gray-600">
                        {effect.balanceChange.assetCode}:{" "}
                        {effect.balanceChange.change}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auth Entries */}
            {simulationResult?.authEntries && simulationResult.authEntries.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs text-gray-600 mb-2">Auth Entries</p>
                <div className="space-y-1">
                  {simulationResult.authEntries.map((entry, idx) => (
                    <p key={idx} className="text-xs bg-blue-50 p-2 rounded">
                      {entry}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {simulationResult?.error && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-xs text-red-700">{simulationResult.error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onProceed}
                disabled={!isSimulationSuccess}
                className={`flex-1 px-4 py-2 rounded text-sm font-medium ${
                  isSimulationSuccess
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Proceed to Sign
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
