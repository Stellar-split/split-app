'use client';

import React, { useEffect, useState } from 'react';

export interface WalletAsset {
  code: string;
  issuer?: string;
  balance: string;
  isNative?: boolean;
}

interface PaymentAssetSelectorProps {
  walletAssets: WalletAsset[];
  invoiceAsset: string;
  selectedAsset: string;
  onAssetChange: (asset: string) => void;
  loading?: boolean;
}

export default function PaymentAssetSelector({
  walletAssets,
  invoiceAsset,
  selectedAsset,
  onAssetChange,
  loading = false,
}: PaymentAssetSelectorProps) {
  const assetOptions = walletAssets.map((asset) => ({
    code: asset.code,
    issuer: asset.issuer,
    label: asset.code,
    balance: asset.balance,
    fullId: asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code,
  }));

  const invoiceAssetDisplay = invoiceAsset === 'XLM'
    ? 'XLM'
    : invoiceAsset.split(':')[0];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">Payment Asset</label>

      <div className="space-y-2">
        {assetOptions.length === 0 ? (
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg text-center">
            <p className="text-gray-400 text-sm">No assets available in your wallet</p>
          </div>
        ) : (
          assetOptions.map((option) => {
            const isMatching = option.fullId === invoiceAsset;
            const isSelected = selectedAsset === option.fullId;

            return (
              <button
                key={option.fullId}
                type="button"
                onClick={() => onAssetChange(option.fullId)}
                disabled={loading}
                className={`w-full p-4 rounded-lg border text-left transition-all disabled:opacity-50 ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 ${
                        isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600'
                      }`}
                    />
                    <div>
                      <div className="font-medium text-white">{option.label}</div>
                      <div className="text-xs text-gray-400">
                        Balance: {parseFloat(option.balance).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 7,
                        })}
                      </div>
                    </div>
                  </div>
                  {isMatching && (
                    <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded font-medium">
                      Invoice Asset
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-300">
          💡 Selecting a different asset will use Stellar's path payment mechanism to convert automatically.
        </p>
      </div>
    </div>
  );
}
