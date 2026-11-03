import type { SplitMeta } from "@/lib/api/invoices";

interface SplitCalculatorProps {
  splitMeta?: SplitMeta;
  readOnly?: boolean;
}

export default function SplitCalculator({ splitMeta, readOnly }: SplitCalculatorProps) {
  return (
    <div className="split-calculator">
      <h3>Split Calculator</h3>
      {splitMeta && (
        <div>
          <p>Total: {splitMeta.totalAmount} {splitMeta.assetCode}</p>
          <p>Recipients: {splitMeta.recipients.length}</p>
        </div>
      )}
      {readOnly && <p className="text-sm text-gray-400">(Read-only)</p>}
    </div>
  );
}
