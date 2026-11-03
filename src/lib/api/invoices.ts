import type { Invoice } from "@stellar-split/sdk";
import type { SplitMeta } from "@/hooks/useSplitCalculator";

export type { SplitMeta };

export interface InvoiceData {
  id: string;
  invoice?: Invoice;
  splitMeta?: SplitMeta;
  [key: string]: any;
}

export async function fetchInvoice(id: string): Promise<InvoiceData> {
  return {
    id,
    invoice: undefined,
    splitMeta: {
      totalAmount: 0,
      assetCode: "USDC",
      recipients: [],
      cosigners: [],
      cosignerThreshold: 1
    }
  };
}

export async function updateInvoice(id: string, data: any): Promise<InvoiceData> {
  return { id, ...data };
}

export async function listInvoices(): Promise<InvoiceData[]> {
  return [];
}
