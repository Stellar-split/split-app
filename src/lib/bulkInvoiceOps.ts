/**
 * bulkInvoiceOps.ts — Bulk operations for multiple invoices: export, print, archive.
 *
 * Issue #810: Add invoice bulk operations — export, print, archive multiple.
 */

import type { Invoice } from "@stellar-split/sdk";
import { formatAmount } from "@stellar-split/sdk";
import { archiveInvoices, unarchiveInvoices } from "@/lib/archiveInvoices";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BulkExportFormat = "csv" | "json";

export interface BulkExportResult {
  filename: string;
  content: string;
  mimeType: string;
}

export interface BulkArchiveResult {
  archivedIds: string[];
  skippedIds: string[];
}

export interface BulkPrintOptions {
  includeQR?: boolean;
  showRecipients?: boolean;
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function escapeCSV(value: string): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function invoicesToCSV(invoices: Invoice[]): string {
  const headers = [
    "Invoice ID",
    "Status",
    "Creator",
    "Total Amount (USDC)",
    "Funded (USDC)",
    "Recipient Count",
    "Deadline",
    "Created",
  ];

  const rows = invoices.map((inv) => {
    const total = inv.recipients.reduce((sum, r) => sum + r.amount, 0n);
    const deadline =
      inv.deadline > 0
        ? new Date(inv.deadline * 1000).toISOString().split("T")[0]
        : "";
    return [
      escapeCSV(String(inv.id)),
      escapeCSV(inv.status),
      escapeCSV(inv.creator),
      escapeCSV(formatAmount(total)),
      escapeCSV(formatAmount(inv.funded)),
      escapeCSV(String(inv.recipients.length)),
      escapeCSV(deadline),
      escapeCSV(""),
    ].join(",");
  });

  return [headers.map(escapeCSV).join(","), ...rows].join("\n");
}

// ── JSON Export ───────────────────────────────────────────────────────────────

function invoicesToJSON(invoices: Invoice[]): string {
  const exportData = invoices.map((inv) => {
    const total = inv.recipients.reduce((sum, r) => sum + r.amount, 0n);
    return {
      id: String(inv.id),
      status: inv.status,
      creator: inv.creator,
      totalAmount: formatAmount(total),
      funded: formatAmount(inv.funded),
      recipientCount: inv.recipients.length,
      deadline:
        inv.deadline > 0
          ? new Date(inv.deadline * 1000).toISOString()
          : null,
      recipients: inv.recipients.map((r) => ({
        address: r.address,
        amount: formatAmount(r.amount),
      })),
    };
  });
  return JSON.stringify(exportData, null, 2);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Export a list of invoices as CSV or JSON.
 * Triggers a browser file download automatically.
 */
export function exportInvoicesBulk(
  invoices: Invoice[],
  format: BulkExportFormat = "csv",
): BulkExportResult {
  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const content = invoicesToJSON(invoices);
    const result: BulkExportResult = {
      filename: `invoices-export-${timestamp}.json`,
      content,
      mimeType: "application/json",
    };
    triggerDownload(result);
    return result;
  }

  const content = invoicesToCSV(invoices);
  const result: BulkExportResult = {
    filename: `invoices-export-${timestamp}.csv`,
    content,
    mimeType: "text/csv",
  };
  triggerDownload(result);
  return result;
}

function triggerDownload({ filename, content, mimeType }: BulkExportResult) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Print a set of invoices using the browser print dialog.
 * Opens a new window with a printable HTML summary.
 */
export function printInvoicesBulk(
  invoices: Invoice[],
  options: BulkPrintOptions = {},
): void {
  if (typeof window === "undefined") return;

  const { showRecipients = true } = options;

  const invoiceRows = invoices
    .map((inv) => {
      const total = inv.recipients.reduce((sum, r) => sum + r.amount, 0n);
      const deadline =
        inv.deadline > 0
          ? new Date(inv.deadline * 1000).toLocaleDateString()
          : "—";

      const recipientRows = showRecipients
        ? inv.recipients
            .map(
              (r) =>
                `<tr><td style="padding:2px 8px;font-size:11px;color:#555;">${r.address}</td>
                 <td style="padding:2px 8px;font-size:11px;text-align:right;">${formatAmount(r.amount)} USDC</td></tr>`,
            )
            .join("")
        : "";

      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;padding:16px;page-break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:600;font-size:14px;">Invoice #${inv.id}</span>
            <span style="font-size:12px;background:#f3f4f6;padding:2px 8px;border-radius:12px;">${inv.status}</span>
          </div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Creator: ${inv.creator}</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Total: ${formatAmount(total)} USDC</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Funded: ${formatAmount(inv.funded)} USDC</div>
          <div style="font-size:12px;color:#6b7280;">Deadline: ${deadline}</div>
          ${
            showRecipients && inv.recipients.length > 0
              ? `<table style="width:100%;margin-top:8px;border-collapse:collapse;">
              <thead><tr>
                <th style="text-align:left;font-size:11px;padding:2px 8px;border-bottom:1px solid #e5e7eb;">Recipient</th>
                <th style="text-align:right;font-size:11px;padding:2px 8px;border-bottom:1px solid #e5e7eb;">Amount</th>
              </tr></thead>
              <tbody>${recipientRows}</tbody>
            </table>`
              : ""
          }
        </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice Print — ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 32px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>StellarSplit — Bulk Invoice Print</h1>
  <p>Printed ${new Date().toLocaleString()} · ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}</p>
  <button onclick="window.print()" style="margin-bottom:24px;padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
    Print / Save as PDF
  </button>
  ${invoiceRows}
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Archive a list of invoices in bulk.
 * Skips invoices that are already archived.
 */
export function archiveInvoicesBulk(
  invoices: Invoice[],
  isArchivedFn: (id: string) => boolean,
): BulkArchiveResult {
  const archivedIds: string[] = [];
  const skippedIds: string[] = [];

  invoices.forEach((inv) => {
    if (isArchivedFn(inv.id)) {
      skippedIds.push(inv.id);
    } else {
      archivedIds.push(inv.id);
    }
  });

  if (archivedIds.length > 0) {
    archiveInvoices(archivedIds);
  }

  return { archivedIds, skippedIds };
}

/**
 * Unarchive a list of invoices in bulk.
 */
export function unarchiveInvoicesBulk(invoiceIds: string[]): void {
  unarchiveInvoices(invoiceIds);
}
