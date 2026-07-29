"use client";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  isCreator: boolean;
  onShare: () => void;
  onDuplicate: () => void;
}

export default function InvoiceDetailActions({
  invoice,
  isCreator,
  onShare,
  onDuplicate,
}: Props) {
  const router = useRouter();

  const handleClone = () => {
    router.push(`/invoice/new?cloneFrom=${invoice.id}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={onShare}
        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
        aria-label="Share invoice"
      >
        Share
      </button>
      <button
        type="button"
        onClick={handleClone}
        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors inline-flex items-center gap-1.5"
        aria-label="Clone invoice to create a new one"
        title="Create a new invoice pre-filled with this invoice's data"
      >
        <Copy size={14} />
        Clone
      </button>
      {isCreator && (
        <button
          type="button"
          onClick={onDuplicate}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
          aria-label="Duplicate invoice"
        >
          Duplicate
        </button>
      )}
    </>
  );
}
