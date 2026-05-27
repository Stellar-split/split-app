import type { Invoice } from "@stellar-split/sdk";

interface DisputeStatus {
  forCount: number;
  againstCount: number;
  resolved: boolean;
}

interface Props {
  invoice: Invoice;
  publicKey: string;
  onDispute: () => Promise<void>;
  disputing: boolean;
  disputeError: string | null;
}

/**
 * DisputePanel — shown to payers on Pending invoices.
 * Renders dispute status banner and a Dispute button.
 */
export default function DisputePanel({
  invoice,
  publicKey,
  onDispute,
  disputing,
  disputeError,
}: Props) {
  const isPayer = invoice.payments.some((p) => p.payer === publicKey);
  if (!isPayer || invoice.status !== "Pending") return null;

  // disputeStatus is not yet in the SDK Invoice type; cast to access if present
  const ds = (invoice as Invoice & { disputeStatus?: DisputeStatus }).disputeStatus;

  return (
    <section className="mt-8 border border-yellow-600 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-yellow-400">Dispute</h2>

      {ds ? (
        <div className="text-sm text-gray-300 flex gap-6">
          <span>👍 For: {ds.forCount}</span>
          <span>👎 Against: {ds.againstCount}</span>
          {ds.resolved && (
            <span className="text-green-400 font-semibold">Resolved</span>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No active dispute.</p>
      )}

      {disputeError && (
        <p className="text-red-400 text-sm">{disputeError}</p>
      )}

      <button
        onClick={onDispute}
        disabled={disputing}
        className="self-start px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {disputing ? "Submitting…" : "Raise Dispute"}
      </button>
    </section>
  );
}
