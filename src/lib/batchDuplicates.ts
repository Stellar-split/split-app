export interface RecipientRow {
  address: string;
  amount: string;
}

export interface InvoiceRow {
  recipients: RecipientRow[];
  deadlineDays: number;
}

export interface DuplicateGroup {
  recipient: string;
  amount: string;
  rowNumbers: number[];
}

export function findBatchDuplicates(rows: InvoiceRow[]): DuplicateGroup[] {
  const seen = new Map<string, number[]>();
  rows.forEach((row, rowIdx) => {
    row.recipients.forEach((r) => {
      if (!r.address.trim() || !r.amount.trim()) return;
      const key = `${r.address.trim().toLowerCase()}|${r.amount.trim()}`;
      const existing = seen.get(key);
      if (existing) {
        existing.push(rowIdx + 1);
      } else {
        seen.set(key, [rowIdx + 1]);
      }
    });
  });
  const duplicates: DuplicateGroup[] = [];
  for (const [key, rowNumbers] of seen) {
    if (rowNumbers.length > 1) {
      const [recipient, amount] = key.split("|");
      duplicates.push({ recipient, amount, rowNumbers });
    }
  }
  return duplicates;
}
