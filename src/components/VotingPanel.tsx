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
 * Displays current extension vote count, a progress bar toward majority,
 * and a "Vote to Extend" button (disabled after voting, tracked in localStorage).
 */
export default function VotingPanel({ invoice, publicKey }: Props) {
  const isPayer = invoice.payments.some((p) => p.payer === publicKey);
  if (!isPayer || invoice.status !== "Pending") return null;

  const totalPayers = new Set(invoice.payments.map((p) => p.payer)).size;
  const majority = Math.ceil((totalPayers + 1) / 2);
  const votes = invoice.extensionVotes ?? 0;
  const pct = totalPayers > 0 ? Math.min(100, Math.round((votes / majority) * 100)) : 0;

  const [voted, setVoted] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY(invoice.id)) === "1"
  );
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVote = async () => {
    setVoting(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (splitClient as any).voteExtendDeadline(invoice.id);
      localStorage.setItem(STORAGE_KEY(invoice.id), "1");
      setVoted(true);
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

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-300">
        <span>
          <span className="font-semibold text-white">{votes}</span> vote{votes !== 1 ? "s" : ""}
        </span>
        <span>
          <span className="font-semibold text-white">{majority}</span> needed for majority
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={votes}
        aria-valuemin={0}
        aria-valuemax={majority}
        aria-label={`${votes} of ${majority} votes`}
        className="w-full h-2 bg-gray-700 rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

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
