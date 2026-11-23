import type { Invoice } from "@stellar-split/sdk";
import { generateInvoiceQualityReport } from "@/lib/dataQuality";

interface Props {
  invoices: Invoice[];
}

export default function DataQualityPanel({ invoices }: Props) {
  const report = generateInvoiceQualityReport(invoices);

  return (
    <div className="bg-yellow-900/10 border border-yellow-700 rounded-xl p-4 mb-6">
      <h3 className="font-semibold text-lg mb-2 text-yellow-300">Data Quality Report</h3>
      <div className="mb-3">
        <strong>Profiling:</strong>
        <ul className="list-disc ml-6">
          {report.profile.map((p) => (
            <li key={p.field}>
              <span className="font-mono text-yellow-200">{p.field}</span>: nulls={p.nullCount}, unique={p.uniqueCount}, min={p.min ?? "-"}, max={p.max ?? "-"}, mean={p.mean?.toFixed(2) ?? "-"}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <strong>Issues:</strong>
        {report.issues.length === 0 ? (
          <span className="ml-2 text-green-400">No major issues detected.</span>
        ) : (
          <ul className="list-disc ml-6">
            {report.issues.map((issue, i) => (
              <li key={i} className="text-yellow-200">
                <span className="font-mono">[{issue.type}]</span> <span className="font-semibold">{issue.field}</span>: {issue.count} — <span className="italic">{issue.suggestion}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
