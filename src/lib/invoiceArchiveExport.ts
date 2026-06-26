/**
 * invoiceArchiveExport.ts — Pure logic for building and downloading
 * a structured JSON archive of an invoice's activity.
 */

import { formatAmount } from "@stellar-split/sdk";

export const ARCHIVE_SCHEMA_VERSION = "1.0.0";

export interface InvoiceArchive {
  schemaVersion: string;
  exportedAt: string; // ISO 8601
  invoice: {
    id: string;
    creator: string;
    status: string;
    deadline: number;
    funded: string; // stringified bigint
    totalAmount: string; // stringified bigint
    recipients: Array<{ address: string; amount: string }>;
  };
  auditLog: Array<{
    action: string;
    actor: string;
    timestamp: number;
  }>;
  payments: Array<{
    payer: string;
    amount: string; // stringified bigint
  }>;
}

export function buildInvoiceArchive(
  invoice: {
    id: string;
    creator: string;
    status: string;
    deadline: number;
    funded: bigint;
    recipients: Array<{ address: string; amount: bigint }>;
  },
  auditLogEntries: Array<{ action: string; actor: string; timestamp: number }>,
  payments: Array<{ payer: string; amount: bigint }>,
): InvoiceArchive {
  const totalAmount = invoice.recipients.reduce(
    (sum, r) => sum + r.amount,
    0n,
  );

  return {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    invoice: {
      id: invoice.id,
      creator: invoice.creator,
      status: invoice.status,
      deadline: invoice.deadline,
      funded: formatAmount(invoice.funded),
      totalAmount: formatAmount(totalAmount),
      recipients: invoice.recipients.map((r) => ({
        address: r.address,
        amount: formatAmount(r.amount),
      })),
    },
    auditLog: auditLogEntries.map((e) => ({
      action: e.action,
      actor: e.actor,
      timestamp: e.timestamp,
    })),
    payments: payments.map((p) => ({
      payer: p.payer,
      amount: formatAmount(p.amount),
    })),
  };
}

export function generateArchiveFilename(invoiceId: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `invoice-${invoiceId}-archive-${timestamp}.json`;
}

export function downloadInvoiceArchive(
  archive: InvoiceArchive,
  filename: string,
): void {
  const json = JSON.stringify(archive, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
