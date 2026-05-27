import type { Invoice } from "@stellar-split/sdk";

interface Props {
  invoice: Invoice;
  total: bigint;
}

const STEPS = ["Created", "Partially Funded", "Fully Funded", "Released / Refunded"] as const;

function getActiveStep(invoice: Invoice, total: bigint): number {
  if (invoice.status === "Released" || invoice.status === "Refunded") return 3;
  if (invoice.funded >= total && total > 0n) return 2;
  if (invoice.funded > 0n) return 1;
  return 0;
}

export default function StatusTimeline({ invoice, total }: Props) {
  const active = getActiveStep(invoice, total);
  const deadlineDate = new Date(invoice.deadline * 1000).toLocaleDateString();

  return (
    <div className="flex items-start gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = i < active;
        const current = i === active;
        const label =
          i === 3 && invoice.status !== "Pending"
            ? invoice.status
            : step;
        const timestamp =
          i === 3 && invoice.status !== "Pending"
            ? null
            : i === 2
            ? `Deadline: ${deadlineDate}`
            : null;

        return (
          <div key={step} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div
                  className={`flex-1 h-0.5 ${done || current ? "bg-indigo-500" : "bg-gray-700"}`}
                />
              )}
              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  done
                    ? "bg-indigo-500 border-indigo-500"
                    : current
                    ? "bg-white border-indigo-400"
                    : "bg-gray-800 border-gray-600"
                }`}
              />
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 ${done ? "bg-indigo-500" : "bg-gray-700"}`}
                />
              )}
            </div>
            <p
              className={`text-xs mt-1 text-center ${
                current ? "text-white font-semibold" : done ? "text-indigo-400" : "text-gray-500"
              }`}
            >
              {label}
            </p>
            {timestamp && (
              <p className="text-xs text-gray-500 text-center">{timestamp}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
