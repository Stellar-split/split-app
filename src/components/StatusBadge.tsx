type Status = 'Pending' | 'Released' | 'Refunded';
interface Props { status: Status; }
const STYLES: Record<Status, string> = {
  Pending: 'bg-yellow-500/20 text-yellow-600',
  Released: 'bg-green-500/20 text-green-600',
  Refunded: 'bg-gray-500/20 text-gray-600',
};
export default function StatusBadge({ status }: Props) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STYLES[status]}`}>{status}</span>;
}
