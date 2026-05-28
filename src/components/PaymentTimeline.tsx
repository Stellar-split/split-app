import { formatAmount } from "@stellar-split/sdk";
import type { Invoice, Payment } from "@stellar-split/sdk";

interface PaymentTimelineProps {
  invoice: Invoice;
  payments: Payment[];
}

export default function PaymentTimeline({ invoice, payments }: PaymentTimelineProps) {
  if (payments.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-600">No payments yet</p>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const timeRange = invoice.deadline - invoice.createdAt;
  const getPosition = (timestamp: number) => {
    const elapsed = Math.max(0, Math.min(timestamp - invoice.createdAt, timeRange));
    return (elapsed / timeRange) * 100;
  };

  const sortedPayments = [...payments].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-6">Payment Timeline</h3>
      <div className="overflow-x-auto pb-4">
        <div className="relative min-w-max" style={{ minWidth: "600px" }}>
          {/* Timeline track */}
          <div className="h-1 bg-gray-200 absolute top-12 left-0 right-0" />

          {/* Deadline marker */}
          <div
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${getPosition(invoice.deadline)}%` }}
          >
            <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow" />
            <div className="text-xs font-semibold text-red-600 mt-6 whitespace-nowrap">
              Deadline
            </div>
            <div className="text-xs text-gray-500">
              {new Date(invoice.deadline * 1000).toLocaleDateString()}
            </div>
          </div>

          {/* Payment markers */}
          <div className="pt-20">
            {sortedPayments.map((payment, idx) => (
              <div
                key={idx}
                className="absolute flex flex-col items-center"
                style={{ left: `${getPosition(payment.timestamp)}%` }}
              >
                <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow" />
                <div className="text-xs font-semibold text-green-600 mt-6 whitespace-nowrap">
                  {formatAmount(payment.amount)} USDC
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(payment.timestamp * 1000).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
