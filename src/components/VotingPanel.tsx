"use client";

import { useState } from "react";
import { splitClient } from "@/lib/stellar";
import type { Invoice } from "@stellar-split/sdk";

const STORAGE_KEY = (id: string) => `voted-extend-${id}`;

interface Props {
  invoice: Invoice & { extensionVotes?: number };
  publicKey: string;
}

/**
 * VotingPanel — shown to payers on Pending invoices.
 * Displays current extension vote count per option with a vote count badge
 * and a percentage fill bar, updating immediately after the user casts their vote.
 */
export default function VotingPanel({ invoice, publicKey }: Props) {
  const isPayer = invoice.payments.some((p) => p.payer === publicKey);

  const totalPayers = new Set(invoice.payments.map((p) => p.payer)).size;
  const majority = Math.ceil((totalPayers + 1) / 2);
  const [votesFor, setVotesFor] = useState(invoice.extensionVotes ?? 0);

  // Derived values
  const votesAgainst = Math.max(0, totalPayers - votesFor);
  const totalVotes = votesFor + votesAgainst;
  const forPct = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0;
  const againstPct = totalVotes > 0 ? Math.round((votesAgainst / totalVotes) * 100) : 0;

  const [voted, setVoted] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY(invoice.id)) === "1"
  );
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPayer || invoice.status !== "Pending") return null;

  const handleVote = async () => {
    setVoting(true);
    setError(null);
    try {
      await (splitClient as any).voteExtendDeadline(invoice.id);
      localStorage.setItem(STORAGE_KEY(invoice.id), "1");
      setVoted(true);
      setVotesFor((prev) => prev + 1);
    } catch (err) {
      setError(String(err));
    } finally {
      setVoting(false);
    }
  };

  return (
    <section
      aria-labelledby="voting-heading"
      className="mb-8 border border-indigo-700 rounded-lg p-4 flex flex-col gap-3"
    >
      <h2 id="voting-heading" className="text-lg font-semibold text-indigo-300">
        Vote to Extend Deadline
      </h2>

      {/* Per-option vote count + percentage fill bars */}
      <div className="flex flex-col gap-2">
        {/* Extend (For) */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-indigo-300 font-medium">Extend deadline</span>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full">
                {votesFor} vote{votesFor !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-gray-400 w-10 text-right tabular-nums">
                {forPct}%
              </span>
            </div>
          </div>
          <div
            role="progressbar"
            aria-valuenow={votesFor}
            aria-valuemin={0}
            aria-valuemax={totalPayers}
            aria-label={`${votesFor} vote${votesFor !== 1 ? "s" : ""} to extend (${forPct}%)`}
            className="w-full h-2 bg-gray-700 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>

        {/* Keep deadline (Against) */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400 font-medium">Keep deadline</span>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-700/60 text-gray-400 font-semibold px-2 py-0.5 rounded-full">
                {votesAgainst} vote{votesAgainst !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-gray-400 w-10 text-right tabular-nums">
                {againstPct}%
              </span>
            </div>
          </div>
          <div
            role="progressbar"
            aria-valuenow={votesAgainst}
            aria-valuemin={0}
            aria-valuemax={totalPayers}
            aria-label={`${votesAgainst} vote${votesAgainst !== 1 ? "s" : ""} to keep deadline (${againstPct}%)`}
            className="w-full h-2 bg-gray-700 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-gray-500 rounded-full transition-all duration-300"
              style={{ width: `${againstPct}%` }}
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        <span className="font-semibold text-white">{majority}</span> votes needed for a majority
        ({totalVotes} of {totalPayers} payer{totalPayers !== 1 ? "s" : ""} voted)
      </p>

      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

      <button
        type="button"
        onClick={handleVote}
        disabled={voted || voting}
        className="self-start min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-default"
      >
        {voting ? "Submitting…" : voted ? "Already Voted" : "Vote to Extend"}
      </button>
    </section>
  );
}
