interface RecipientRow {
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

export interface BundleInvoice {
  id: string;
  currency: string;
  status: string;
  recipients: RecipientRow[];
}

export interface BundleDuplicateGroup {
  recipient: string;
  amount: string;
  invoiceIds: string[];
}

export interface BundleCurrencyCheck {
  compatible: boolean;
  currencies: string[];
  mismatchedInvoiceIds: string[];
}

export interface BundleEligibility {
  eligible: boolean;
  eligibleInvoiceIds: string[];
  ineligibleInvoiceIds: string[];
  reasons: Record<string, string>;
}

const BUNDLE_ELIGIBLE_STATUSES = new Set(["pending", "draft", "unpaid", "open"]);

export function findBundleDuplicates(invoices: BundleInvoice[]): BundleDuplicateGroup[] {
  const seen = new Map<string, string[]>();
  invoices.forEach((invoice) => {
    invoice.recipients.forEach((r) => {
      if (!r.address.trim() || !r.amount.trim()) return;
      const key = `${r.address.trim().toLowerCase()}|${r.amount.trim()}`;
      const existing = seen.get(key);
      if (existing) {
        if (!existing.includes(invoice.id)) existing.push(invoice.id);
      } else {
        seen.set(key, [invoice.id]);
      }
    });
  });
  const duplicates: BundleDuplicateGroup[] = [];
  for (const [key, invoiceIds] of seen) {
    if (invoiceIds.length > 1) {
      const [recipient, amount] = key.split("|");
      duplicates.push({ recipient, amount, invoiceIds });
    }
  }
  return duplicates;
}

export function checkBundleCurrencyCompatibility(invoices: BundleInvoice[]): BundleCurrencyCheck {
  const currencies: string[] = [];
  const counts = new Map<string, number>();
  invoices.forEach((invoice) => {
    const currency = (invoice.currency || "").trim().toUpperCase();
    if (!currency) return;
    if (!currencies.includes(currency)) currencies.push(currency);
    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  });

  if (currencies.length <= 1) {
    return { compatible: true, currencies, mismatchedInvoiceIds: [] };
  }

  let dominant = currencies[0];
  let dominantCount = counts.get(dominant) ?? 0;
  for (const currency of currencies) {
    const count = counts.get(currency) ?? 0;
    if (count > dominantCount) {
      dominant = currency;
      dominantCount = count;
    }
  }

  const mismatchedInvoiceIds = invoices
    .filter((invoice) => (invoice.currency || "").trim().toUpperCase() !== dominant)
    .map((invoice) => invoice.id);

  return { compatible: false, currencies, mismatchedInvoiceIds };
}

export function computeBundleEligibility(invoices: BundleInvoice[]): BundleEligibility {
  const eligibleInvoiceIds: string[] = [];
  const ineligibleInvoiceIds: string[] = [];
  const reasons: Record<string, string> = {};

  invoices.forEach((invoice) => {
    const status = (invoice.status || "").trim().toLowerCase();
    if (!status) {
      ineligibleInvoiceIds.push(invoice.id);
      reasons[invoice.id] = "Invoice has no status";
      return;
    }
    if (!BUNDLE_ELIGIBLE_STATUSES.has(status)) {
      ineligibleInvoiceIds.push(invoice.id);
      reasons[invoice.id] = `Invoice status "${invoice.status}" is not eligible for bundling`;
      return;
    }
    eligibleInvoiceIds.push(invoice.id);
  });

  return {
    eligible: ineligibleInvoiceIds.length === 0 && eligibleInvoiceIds.length > 0,
    eligibleInvoiceIds,
    ineligibleInvoiceIds,
    reasons,
  };
}