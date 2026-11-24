export interface StatusConfig {
  color: string;
  label: string;
  icon?: string;
  description: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  Pending: {
    color: 'blue',
    label: 'Pending',
    icon: '⏳',
    description: 'Awaiting funding from the payer.',
  },
  Active: {
    color: 'blue',
    label: 'Active',
    icon: '🔄',
    description: 'Invoice is active and accepting payments.',
  },
  Funded: {
    color: 'green',
    label: 'Funded',
    icon: '✅',
    description: 'Fully funded and ready to be released.',
  },
  Released: {
    color: 'green',
    label: 'Released',
    icon: '✓',
    description: 'Funds have been released to the recipients.',
  },
  Refunded: {
    color: 'red',
    label: 'Refunded',
    icon: '↩️',
    description: 'Funds have been refunded to the payer.',
  },
  Disputed: {
    color: 'red',
    label: 'Disputed',
    icon: '⚠️',
    description: 'A dispute is open and awaiting resolution.',
  },
  Frozen: {
    color: 'gray',
    label: 'Frozen',
    icon: '❄️',
    description: 'Invoice is frozen pending review.',
  },
  Archived: {
    color: 'gray',
    label: 'Archived',
    icon: '📦',
    description: 'Invoice has been archived.',
  },
  Expired: {
    color: 'gray',
    label: 'Expired',
    icon: '⌛',
    description: 'Invoice expired before being funded.',
  },
  Cancelled: {
    color: 'gray',
    label: 'Cancelled',
    icon: '✕',
    description: 'Invoice was cancelled by the creator.',
  },
};

export function getDisputesByInvoice(invoiceId: string): any[] {
  return [];
}

export function checkReleaseBlock(invoice: any): string | null {
  return null;
}
