"use client";

import { X } from "lucide-react";
import { useState } from "react";

interface Props {
  sourceId: string;
  onDismiss?: () => void;
}

export default function CloneBanner({ sourceId, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-blue-300 mb-1">Cloning Invoice #{sourceId}</h3>
        <p className="text-sm text-blue-200">
          This form has been pre-filled with data from the source invoice. Review and adjust the details before saving to create a new invoice.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 hover:bg-blue-800/30 rounded transition-colors"
        aria-label="Dismiss banner"
      >
        <X size={16} className="text-blue-300" />
      </button>
    </div>
  );
}
