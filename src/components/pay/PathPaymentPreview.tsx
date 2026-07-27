'use client';

import React from 'react';
import type { PathPaymentResult } from '@/hooks/usePathPayment';

interface PathPaymentPreviewProps {
  pathResult: PathPaymentResult | null;
  loading: boolean;
  error: string | null;
}

export default function PathPaymentPreview({
  pathResult,
  loading,
  error,
}: PathPaymentPreviewProps) {
  if (!pathResult) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 animate-pulse">
        <p className="text-sm text-blue-300">Computing conversion path...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-sm text-red-300">⚠️ {error}</p>
      </div>
    );
  }

  const sourceAssetDisplay = pathResult.sourceAsset === 'XLM'
    ? 'XLM'
    : pathResult.sourceAsset.split(':')[0];

  const destAssetDisplay = pathResult.destinationAsset === 'XLM'
    ? 'XLM'
    : pathResult.destinationAsset.split(':')[0];

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Exchange Rate</span>
        <span className="text-sm font-medium text-indigo-300">
          1 {sourceAssetDisplay} = {pathResult.exchangeRate.toFixed(6)} {destAssetDisplay}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">You Send</span>
        <span className="text-sm font-semibold text-white">
          {parseFloat(pathResult.sourceAmount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 7,
          })}{' '}
          {sourceAssetDisplay}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Recipient Gets</span>
        <span className="text-sm font-semibold text-green-400">
          {parseFloat(pathResult.destinationAmount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 7,
          })}{' '}
          {destAssetDisplay}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-indigo-500/20">
        <span className="text-xs text-gray-500">Slippage Tolerance</span>
        <span className="text-xs text-indigo-300">{pathResult.slippage}%</span>
      </div>

      <div className="text-xs text-gray-500 pt-2">
        Conversion path: {pathResult.path.length === 0 ? 'Direct' : pathResult.path.join(' → ')}
      </div>
    </div>
  );
}
