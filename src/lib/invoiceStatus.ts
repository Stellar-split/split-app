export type InvoiceStatus =
  | "Pending"
  | "Active"
  | "Funded"
  | "Released"
  | "Refunded"
  | "Disputed"
  | "Frozen"
  | "Archived"
  | "Expired";

export interface StatusConfig {
  label: string;
  colorClass: string;
  icon?: string;
  description: string;
}

export const STATUS_CONFIG: Record<InvoiceStatus, StatusConfig> = {
  Pending: {
    label: "Pending",
    colorClass: "bg-yellow-500/20 text-yellow-400",
    icon: "⏳",
    description: "Waiting for recipient action or payment initiation",
  },
  Active: {
    label: "Active",
    colorClass: "bg-blue-500/20 text-blue-400",
    description: "Invoice is currently active and awaiting payment",
  },
  Funded: {
    label: "Funded",
    colorClass: "bg-cyan-500/20 text-cyan-400",
    description: "Invoice has been funded but not yet released",
  },
  Released: {
    label: "Released",
    colorClass: "bg-green-500/20 text-green-400",
    icon: "✓",
    description: "Payment has been successfully released to recipient",
  },
  Refunded: {
    label: "Refunded",
    colorClass: "bg-gray-500/20 text-gray-400",
    description: "Payment has been refunded to original sender",
  },
  Disputed: {
    label: "Disputed",
    colorClass: "bg-red-500/20 text-red-400",
    icon: "⚠",
    description: "Invoice is under dispute and requires resolution",
  },
  Frozen: {
    label: "Frozen",
    colorClass: "bg-indigo-500/20 text-indigo-400",
    icon: "🔒",
    description: "Invoice is frozen and cannot be modified or released",
  },
  Archived: {
    label: "Archived",
    colorClass: "bg-stone-500/20 text-stone-400",
    description: "Invoice has been archived and is no longer active",
  },
  Expired: {
    label: "Expired",
    colorClass: "bg-orange-500/20 text-orange-400",
    description: "Invoice has expired and can no longer be paid or modified",
  },
};
