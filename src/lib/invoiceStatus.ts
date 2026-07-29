import type { Invoice } from "@stellar-split/sdk";

export type InvoiceStatus = Invoice["status"] | "Archived" | "Expired";

export interface StatusConfig {
  label: string;
  colorClass: string;
  icon?: string;
}

export const STATUS_CONFIG: Record<InvoiceStatus, StatusConfig> = {
  Pending: {
    label: "Pending",
    colorClass: "bg-yellow-500/20 text-yellow-400",
    icon: "⏳",
  },
  Active: {
    label: "Active",
    colorClass: "bg-blue-500/20 text-blue-400",
  },
  Funded: {
    label: "Funded",
    colorClass: "bg-cyan-500/20 text-cyan-400",
  },
  Released: {
    label: "Released",
    colorClass: "bg-green-500/20 text-green-400",
    icon: "✓",
  },
  Refunded: {
    label: "Refunded",
    colorClass: "bg-gray-500/20 text-gray-400",
  },
  Disputed: {
    label: "Disputed",
    colorClass: "bg-red-500/20 text-red-400",
    icon: "⚠",
  },
  Frozen: {
    label: "Frozen",
    colorClass: "bg-indigo-500/20 text-indigo-400",
    icon: "🔒",
  },
  Archived: {
    label: "Archived",
    colorClass: "bg-stone-500/20 text-stone-400",
  },
  Expired: {
    label: "Expired",
    colorClass: "bg-orange-500/20 text-orange-400",
  },
};
