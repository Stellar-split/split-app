import { formatAmount, type Invoice } from '@stellar-split/sdk';

export type InvoiceExportFormat = 'json' | 'xml' | 'html' | 'custom';

export interface InvoiceExportData {
  id: string;
  creator: string;
  status: string;
  token: string;
  total: string;
  funded: string;
  deadline: string | null;
  recipients: Array<{ address: string; amount: string }>;
  payments: Array<{ payer: string; amount: string }>;
}

export interface GeneratedInvoiceExport {
  content: string;
  mimeType: string;
  extension: string;
}

export function toInvoiceExportData(invoice: Invoice, total: bigint): InvoiceExportData {
  return {
    id: invoice.id,
    creator: invoice.creator,
    status: invoice.status,
    token: invoice.token || 'USDC',
    total: formatAmount(total),
    funded: formatAmount(invoice.funded),
    deadline: invoice.deadline > 0 ? new Date(invoice.deadline * 1000).toISOString() : null,
    recipients: invoice.recipients.map(({ address, amount }) => ({ address, amount: formatAmount(amount) })),
    payments: invoice.payments.map(({ payer, amount }) => ({ payer, amount: formatAmount(amount) })),
  };
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character]!);
}

function escapeHtml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!);
}

function xmlElement(name: string, value: unknown): string {
  if (value === null || value === undefined) return `<${name}/>`;
  if (Array.isArray(value)) return `<${name}>${value.map((item) => xmlElement('item', item)).join('')}</${name}>`;
  if (typeof value === 'object') {
    const children = Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => xmlElement(key, child))
      .join('');
    return `<${name}>${children}</${name}>`;
  }
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function customExport(data: InvoiceExportData, template: string): string {
  return template.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (placeholder, path: string) => {
    const value = path.split('.').reduce<unknown>((current, key) => {
      if (typeof current !== 'object' || current === null) return undefined;
      return (current as Record<string, unknown>)[key];
    }, data);
    if (value === undefined || value === null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

export function generateInvoiceExport(
  invoice: Invoice,
  total: bigint,
  format: InvoiceExportFormat,
  customTemplate = ''
): GeneratedInvoiceExport {
  const data = toInvoiceExportData(invoice, total);
  if (format === 'json') {
    return { content: JSON.stringify(data, null, 2), mimeType: 'application/json;charset=utf-8', extension: 'json' };
  }
  if (format === 'xml') {
    return { content: `<?xml version="1.0" encoding="UTF-8"?>\n${xmlElement('invoice', data)}`, mimeType: 'application/xml;charset=utf-8', extension: 'xml' };
  }
  if (format === 'html') {
    const rows = Object.entries(data)
      .filter(([, value]) => !Array.isArray(value))
      .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value === null ? '' : String(value))}</td></tr>`)
      .join('');
    const recipients = data.recipients.map((recipient) => `<tr><td>${escapeHtml(recipient.address)}</td><td>${escapeHtml(recipient.amount)} ${escapeHtml(data.token)}</td></tr>`).join('');
    const payments = data.payments.map((payment) => `<tr><td>${escapeHtml(payment.payer)}</td><td>${escapeHtml(payment.amount)} ${escapeHtml(data.token)}</td></tr>`).join('');
    return {
      content: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Invoice ${escapeHtml(data.id)}</title><style>body{font:16px/1.5 sans-serif;color:#17212b;margin:2rem}main{max-width:900px;margin:auto}h1{border-bottom:2px solid #177e89;padding-bottom:.5rem}table{width:100%;border-collapse:collapse;margin:0 0 1.5rem}th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #d8e0e5}th{background:#f0f5f5}thead th{background:#177e89;color:#fff}@media print{body{margin:0}main{max-width:none}}</style></head><body><main><h1>Invoice ${escapeHtml(data.id)}</h1><table><tbody>${rows}</tbody></table><h2>Recipients</h2><table><thead><tr><th>Address</th><th>Amount</th></tr></thead><tbody>${recipients}</tbody></table><h2>Payments</h2><table><thead><tr><th>Payer</th><th>Amount</th></tr></thead><tbody>${payments}</tbody></table></main></body></html>`,
      mimeType: 'text/html;charset=utf-8',
      extension: 'html',
    };
  }
  return { content: customExport(data, customTemplate), mimeType: 'text/plain;charset=utf-8', extension: 'txt' };
}