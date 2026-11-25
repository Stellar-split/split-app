import type { SplitMeta } from "@/hooks/useSplitCalculator";
import SplitBuilder from "@/components/invoice/SplitBuilder";

interface SplitCalculatorProps {
  splitMeta?: SplitMeta;
  onSplitMetaChange?: (meta: SplitMeta) => void;
  readOnly?: boolean;
}

/**
 * SplitCalculator — thin wrapper around the split builder so invoice pages and
 * tests share one entry point for editing recipient shares.
 */
export default function SplitCalculator({
  splitMeta,
  onSplitMetaChange,
  readOnly,
}: SplitCalculatorProps) {
  return (
    <div className="split-calculator">
      <SplitBuilder
        splitMeta={splitMeta}
        onSplitMetaChange={onSplitMetaChange}
        readOnly={readOnly}
      />
    </div>
  );
}
