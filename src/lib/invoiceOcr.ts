export interface InvoiceOcrFields {
  recipient_address: string;
  amount: string;
  deadline_days: string;
  token: string;
}

export type InvoiceOcrField = keyof InvoiceOcrFields;

export interface InvoiceOcrResult {
  fields: InvoiceOcrFields;
  confidence: Record<InvoiceOcrField, number>;
  text: string;
}

export interface InvoiceOcrAnalytics {
  extractions: number;
  reviewedFields: number;
  correctedFields: number;
}

const ANALYTICS_KEY = 'invoice_ocr_analytics_v1';

function fieldConfidence(base: number, matched: boolean, multiplier: number): number {
  if (!matched) return 0;
  return Math.max(0, Math.min(100, Math.round(base * multiplier)));
}

export function recognizeInvoiceFields(text: string, engineConfidence: number): InvoiceOcrResult {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const base = Math.max(0, Math.min(100, engineConfidence));
  const address = normalized.match(/\bG[A-Z2-7]{55}\b/)?.[0] ?? '';
  const amountMatch = normalized.match(/(?:total(?:\s+due)?|amount(?:\s+due)?|usdc)\s*[:=$]?\s*([\d,]+(?:\.\d{1,7})?)/i)
    ?? normalized.match(/\b([\d,]+\.\d{2})\s*(?:USDC|USD)\b/i);
  const amount = amountMatch?.[1]?.replace(/,/g, '') ?? '';
  const token = normalized.match(/\b(USDC|XLM)\b/i)?.[1]?.toUpperCase() ?? '';
  const deadlineMatch = normalized.match(/(?:due|deadline)\s*(?:in\s*)?(\d+)\s*days?/i);
  let deadlineDays = deadlineMatch?.[1] ?? '';
  let deadlineMatched = Boolean(deadlineMatch);
  if (!deadlineDays) {
    const dateMatch = normalized.match(/(?:due|deadline)\s*(?:date)?\s*[:#-]?\s*(\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      const date = new Date(`${dateMatch[1]}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        deadlineDays = String(Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000)));
        deadlineMatched = true;
      }
    }
  }

  return {
    fields: { recipient_address: address, amount, deadline_days: deadlineDays, token },
    confidence: {
      recipient_address: fieldConfidence(base, Boolean(address), address.length === 56 ? 1 : 0.5),
      amount: fieldConfidence(base, Boolean(amount), amountMatch?.[0].toLowerCase().includes('total') ? 0.95 : 0.8),
      deadline_days: fieldConfidence(base, deadlineMatched, 0.8),
      token: fieldConfidence(base, Boolean(token), 0.95),
    },
    text,
  };
}

export function getInvoiceOcrAnalytics(): InvoiceOcrAnalytics {
  if (typeof window === 'undefined') return { extractions: 0, reviewedFields: 0, correctedFields: 0 };
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ANALYTICS_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid analytics');
    const analytics = parsed as Partial<InvoiceOcrAnalytics>;
    return {
      extractions: Number(analytics.extractions) || 0,
      reviewedFields: Number(analytics.reviewedFields) || 0,
      correctedFields: Number(analytics.correctedFields) || 0,
    };
  } catch {
    return { extractions: 0, reviewedFields: 0, correctedFields: 0 };
  }
}

export function recordInvoiceOcrReview(original: InvoiceOcrFields, corrected: InvoiceOcrFields): void {
  if (typeof window === 'undefined') return;
  const current = getInvoiceOcrAnalytics();
  const fields = Object.keys(original) as InvoiceOcrField[];
  const correctedFields = fields.filter((field) => original[field] !== corrected[field]).length;
  const updated = {
    extractions: current.extractions + 1,
    reviewedFields: current.reviewedFields + fields.length,
    correctedFields: current.correctedFields + correctedFields,
  };
  try {
    window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(updated));
  } catch {
    // OCR extraction and correction are still usable when storage is unavailable.
  }
}