'use client';

interface SplitSummaryCardProps {
  totalAmount: number;
  recipientCount: number;
  roundingAdjustment?: number;
  recipientIndex?: number;
}

export default function SplitSummaryCard({
  totalAmount,
  recipientCount,
  roundingAdjustment = 0,
  recipientIndex = 0,
}: SplitSummaryCardProps) {
  const hasRoundingAdjustment = roundingAdjustment !== 0 && roundingAdjustment !== undefined;

  return (
    <div className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Total amount:</span>
          <span className="text-sm font-mono text-gray-200">{totalAmount} USDC</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Recipients:</span>
          <span className="text-sm font-mono text-gray-200">{recipientCount}</span>
        </div>

        {hasRoundingAdjustment && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="flex items-start gap-2">
              <span className="text-yellow-500 text-sm">⚠</span>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-yellow-400">
                  Rounding adjustment applied
                </p>
                <p className="text-xs text-gray-400">
                  {recipientIndex === 0 ? 'First' : `Recipient ${recipientIndex + 1}`} received {Math.abs(roundingAdjustment)} additional stroops to resolve rounding discrepancy.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
