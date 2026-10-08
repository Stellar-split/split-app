"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFreighterPublicKey } from "@/lib/freighter";
import { splitClient } from "@/lib/stellar";
import { truncateAddress } from "@stellar-split/sdk";
import type { Invoice } from "@stellar-split/sdk";
import PayerReputationDisplay, {
  computePayerScore,
  type PayerReputationData,
} from "@/components/PayerReputationDisplay";

/** Build reputation data from on-chain invoice history for a given payer */
function buildReputationData(
  address: string,
  invoices: Invoice[]
): PayerReputationData {
  const now = Math.floor(Date.now() / 1000);
  let totalPaid = 0;
  let onTimePaid = 0;
  let disputeCount = 0;
  let disputeWins = 0;
  let totalVolume = 0n;

  for (const inv of invoices) {
    for (const p of inv.payments) {
      if (p.payer !== address) continue;
      totalPaid++;
      totalVolume += p.amount;
      if ((p as any).timestamp && inv.deadline && (p as any).timestamp <= inv.deadline) {
        onTimePaid++;
      }
    }
    if (
      ((inv as any).status === "Disputed" || inv.status === "Released") &&
      inv.payments.some((p) => p.payer === address)
    ) {
      if ((inv as any).status === "Disputed") {
        disputeCount++;
      }
    }
  }

  const score = computePayerScore({
    totalPaid,
    onTimePaid,
    disputeCount,
    disputeWins,
  });

  const volumeUsdc = (Number(totalVolume) / 1e7).toFixed(2);

  return {
    address,
    score,
    totalPaid,
    onTimePaid,
    disputeCount,
    disputeWins,
    volumeUsdc,
  };
}

// ─── Top payers leaderboard ───────────────────────────────────────────────────

interface PayerEntry {
  address: string;
  score: number;
  totalPaid: number;
  volumeUsdc: string;
}

function PayerLeaderboardRow({
  entry,
  rank,
  isMe,
  selected,
  onSelect,
}: {
  entry: PayerEntry;
  rank: number;
  isMe: boolean;
  selected: boolean;
  onSelect: (address: string) => void;
}) {
  const scoreColor =
    entry.score >= 90
      ? "text-emerald-400"
      : entry.score >= 70
      ? "text-indigo-400"
      : entry.score >= 50
      ? "text-sky-400"
      : entry.score >= 25
      ? "text-amber-400"
      : "text-red-400";

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.address)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors rounded-lg ${
        selected
          ? "bg-indigo-600/20 border border-indigo-500/30"
          : isMe
          ? "bg-indigo-500/10 hover:bg-indigo-500/20"
          : "hover:bg-gray-800/60"
      }`}
      aria-label={`View reputation for ${truncateAddress(entry.address)}, rank ${rank}`}
      aria-pressed={selected}
    >
      <span className="text-xs font-bold text-gray-500 w-6 text-center shrink-0">
        #{rank}
      </span>
      <span className="font-mono text-xs text-gray-300 flex-1 truncate" title={entry.address}>
        {truncateAddress(entry.address)}
        {isMe && (
          <span className="ml-1.5 text-indigo-400 font-semibold">(you)</span>
        )}
      </span>
      <span className={`text-xs font-bold ${scoreColor}`}>
        {entry.score}
      </span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PayerReputationPage() {
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [myData, setMyData] = useState<PayerReputationData | null>(null);
  const [leaderboard, setLeaderboard] = useState<PayerEntry[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<PayerReputationData | null>(null);
  const [lookupInput, setLookupInput] = useState("");
  const [lookupAddress, setLookupAddress] = useState<string | null>(null);

  // Load wallet
  useEffect(() => {
    getFreighterPublicKey()
      .then((addr) => {
        setMyAddress(addr);
      })
      .catch(() => setMyAddress(null))
      .finally(() => setLoadingMine(false));
  }, []);

  // Load own reputation from on-chain data
  useEffect(() => {
    if (!myAddress) {
      setLoadingMine(false);
      return;
    }
    const run = async () => {
      try {
        const invoices: Invoice[] = [];
        for (let id = 1; id <= 50; id++) {
          try {
            const inv = await splitClient.getInvoice(String(id));
            invoices.push(inv);
          } catch {
            break;
          }
        }
        setMyData(buildReputationData(myAddress, invoices));

        // Build leaderboard from unique payers
        const payerMap = new Map<string, Invoice[]>();
        for (const inv of invoices) {
          for (const p of inv.payments) {
            if (!payerMap.has(p.payer)) payerMap.set(p.payer, []);
            payerMap.get(p.payer)!.push(inv);
          }
        }
        const entries: PayerEntry[] = Array.from(payerMap.entries())
          .map(([addr, invs]) => {
            const d = buildReputationData(addr, invs);
            return {
              address: addr,
              score: d.score,
              totalPaid: d.totalPaid,
              volumeUsdc: d.volumeUsdc,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);

        setLeaderboard(entries);
      } catch {
        // ignore
      } finally {
        setLoadingMine(false);
        setLoadingLeaderboard(false);
      }
    };
    run();
  }, [myAddress]);

  const handleSelectAddress = (address: string) => {
    setSelectedAddress(address);
    // Reuse myData if it's the same address
    if (address === myAddress && myData) {
      setSelectedData(myData);
    } else {
      setSelectedData(null); // let PayerReputationDisplay simulate
    }
  };

  const handleLookup = () => {
    const addr = lookupInput.trim();
    if (!addr) return;
    setLookupAddress(addr);
    setSelectedAddress(addr);
    setSelectedData(null);
  };

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-white" aria-current="page">
            Payer Reputation
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Payer Reputation Scores
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
          Reputation scores reflect on-time payment history, dispute win rate,
          and total payment volume. A higher score signals a reliable payer.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: my score + leaderboard */}
        <div className="lg:col-span-2 space-y-5">
          {/* My reputation */}
          <section aria-labelledby="my-rep-heading">
            <h2 id="my-rep-heading" className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Your Score
            </h2>
            {loadingMine ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse space-y-3">
                <div className="h-4 bg-gray-700 rounded w-1/2" />
                <div className="h-16 bg-gray-700 rounded" />
              </div>
            ) : !myAddress ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400">
                Connect your wallet to see your payer reputation.
              </div>
            ) : myData ? (
              <PayerReputationDisplay
                address={myAddress}
                data={myData}
                showAddress
              />
            ) : null}
          </section>

          {/* Address lookup */}
          <section aria-labelledby="lookup-heading">
            <h2 id="lookup-heading" className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Look Up Any Payer
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="Stellar address G…"
                aria-label="Enter Stellar address to look up"
                className="flex-1 min-w-0 bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
              />
              <button
                type="button"
                onClick={handleLookup}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
                aria-label="Look up payer reputation"
              >
                Look up
              </button>
            </div>
          </section>

          {/* Leaderboard */}
          <section aria-labelledby="leaderboard-heading">
            <h2 id="leaderboard-heading" className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Top Payers
            </h2>
            {loadingLeaderboard ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-gray-800 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                No payer data found on-chain yet.
              </p>
            ) : (
              <div
                role="list"
                aria-label="Top payers by reputation score"
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800"
              >
                {leaderboard.map((entry, idx) => (
                  <div key={entry.address} role="listitem">
                    <PayerLeaderboardRow
                      entry={entry}
                      rank={idx + 1}
                      isMe={entry.address === myAddress}
                      selected={selectedAddress === entry.address}
                      onSelect={handleSelectAddress}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column: detail view */}
        <div className="lg:col-span-3">
          <section aria-labelledby="detail-heading">
            <h2 id="detail-heading" className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Reputation Detail
            </h2>

            {selectedAddress || lookupAddress ? (
              <PayerReputationDisplay
                address={(selectedAddress ?? lookupAddress)!}
                data={selectedData ?? undefined}
                showAddress
              />
            ) : (
              <div className="flex flex-col items-center justify-center bg-gray-900 border border-gray-800 rounded-xl p-10 text-center gap-3">
                <span className="text-3xl" aria-hidden="true">👆</span>
                <p className="text-sm text-gray-400">
                  Select a payer from the leaderboard or enter an address to
                  view their full reputation breakdown.
                </p>
              </div>
            )}
          </section>

          {/* Scoring explanation */}
          <section
            aria-labelledby="scoring-heading"
            className="mt-5 bg-gray-900 border border-gray-800 rounded-xl p-5"
          >
            <h2 id="scoring-heading" className="text-sm font-semibold text-white mb-3">
              How is the score calculated?
            </h2>
            <ul className="space-y-2 text-xs text-gray-400">
              {[
                ["40%", "On-time payment rate", "Percentage of invoices paid before deadline"],
                ["30%", "Dispute win rate", "Percentage of disputes resolved in payer's favour (neutral if none)"],
                ["20%", "Volume component", "Scaled from total number of invoices paid (capped at 30 pts)"],
                ["10%", "Activity bonus", "Extra points for consistent participation (20+ invoices)"],
              ].map(([weight, label, desc]) => (
                <li key={label} className="flex gap-3">
                  <span className="text-indigo-400 font-bold shrink-0 w-8">{weight}</span>
                  <div>
                    <span className="text-gray-200 font-semibold">{label}</span>
                    <span className="text-gray-500"> — {desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
