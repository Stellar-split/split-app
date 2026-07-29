import { STATUS_CONFIG, type InvoiceStatus } from "@/lib/invoiceStatus";

interface Props {
  status: InvoiceStatus;
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<string, string> = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

/**
 * StatusBadge — colour-coded chip for every invoice state.
 * Consumes centralized STATUS_CONFIG from src/lib/invoiceStatus.ts
 */
export default function StatusBadge({ status, size = "md" }: Props) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span
      role="status"
      aria-label={`Status: ${status}`}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${SIZE[size]} ${config.colorClass}`}
    >
      {config.icon && <span aria-hidden="true">{config.icon}</span>}
      {config.label}
    </span>
  );
}
