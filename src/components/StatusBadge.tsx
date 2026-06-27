type Status = 'Pending' | 'Released' | 'Refunded';
interface Props { status: Status; }
const STYLES: Record<Status, string> = {
  Pending: 'bg-yellow-500/20 text-yellow-600',
  Released: 'bg-green-500/20 text-green-600',
  Refunded: 'bg-gray-500/20 text-gray-600',
};
export default function StatusBadge({ status }: Props) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STYLES[status]}`}>{status}</span>;
import type { Invoice } from "@stellar-split/sdk";

type InvoiceStatus = Invoice["status"] | "Archived" | "Expired";

interface Props {
  status: InvoiceStatus;
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<string, string> = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

const STYLES: Record<string, string> = {
  Pending:  "bg-yellow-500/20  text-yellow-400",
  Active:   "bg-blue-500/20    text-blue-400",
  Funded:   "bg-cyan-500/20    text-cyan-400",
  Released: "bg-green-500/20   text-green-400",
  Refunded: "bg-gray-500/20    text-gray-400",
  Disputed: "bg-red-500/20     text-red-400",
  Frozen:   "bg-indigo-500/20  text-indigo-400",
  Archived: "bg-stone-500/20   text-stone-400",
  Expired:  "bg-orange-500/20  text-orange-400",
};

const ICON: Record<string, string> = {
  Released: "✓",
  Disputed: "⚠",
  Frozen:   "🔒",
};

/**
 * StatusBadge — colour-coded chip for every invoice state.
 */
export default function StatusBadge({ status, size = "md" }: Props) {
  const icon = ICON[status];
  const style = STYLES[status] ?? "bg-gray-500/20 text-gray-400";

  return (
    <span
      role="status"
      aria-label={`Status: ${status}`}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${SIZE[size]} ${style}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {status}
    </span>
  );
}
