"use client";

interface RecipientRow {
  address: string;
  amount: string;
}

interface Props {
  recipients: RecipientRow[];
  onChange: (rows: RecipientRow[]) => void;
  equalSplit?: boolean;
  amountOverride?: string;
}

/**
 * RecipientForm — dynamic add/remove rows for recipients and split amounts.
 */
export default function RecipientForm({
  recipients,
  onChange,
  equalSplit = false,
  amountOverride,
}: Props) {
  const update = (index: number, field: keyof RecipientRow, value: string) => {
    const next = recipients.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    onChange(next);
  };

  const addRow = () => onChange([...recipients, { address: "", amount: "" }]);

  const removeRow = (index: number) =>
    onChange(recipients.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3">
      {recipients.map((row, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            type="text"
            placeholder="G... address"
            value={row.address}
            onChange={(e) => update(i, "address", e.target.value)}
            required
            aria-label={`Recipient ${i + 1} address`}
            className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono min-w-0 text-gray-800 dark:text-gray-100"
          />
          <input
            type="number"
            placeholder="USDC"
            step="0.0000001"
            min="0.0000001"
            value={equalSplit ? (amountOverride ?? "") : row.amount}
            onChange={
              equalSplit ? undefined : (e) => update(i, "amount", e.target.value)
            }
            readOnly={equalSplit}
            required
            aria-label={`Recipient ${i + 1} amount`}
            className={`w-28 bg-gray-100 dark:bg-gray-800 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 dark:text-gray-100 ${
              equalSplit
                ? "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                : "border-gray-300 dark:border-gray-700"
            }`}
          />
          {recipients.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={`Remove recipient ${i + 1}`}
              className="px-3 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 hover:bg-red-600 dark:hover:bg-red-700 text-sm transition-colors text-gray-800 dark:text-gray-100"
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="self-start px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-sm transition-colors text-gray-800 dark:text-gray-100"
      >
        + Add Recipient
      </button>
    </div>
  );
}