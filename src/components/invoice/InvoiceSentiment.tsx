"use client";

import type { Invoice } from "@stellar-split/sdk";

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface SentimentResult {
  label: SentimentLabel;
  /** Score from -100 (very negative) to 100 (very positive). */
  score: number;
  signals: string[];
}

/**
 * Derives a funding sentiment for an invoice from its progress, payer
 * participation and time remaining until the deadline.
 */
export function analyzeInvoiceSentiment(invoice: Invoice, nowSec = Math.floor(Date.now() / 1000)): SentimentResult {
  if (invoice.status === "Released") return { label: "positive", score: 100, signals: ["Funds released"] };
  if (invoice.status === "Refunded") return { label: "negative", score: -100, signals: ["Invoice refunded"] };

  const total = invoice.recipients.reduce((sum, r) => sum + r.amount, 0n);
  const progress = total > 0n ? Number((invoice.funded * 100n) / total) : 0;
  const payers = new Set(invoice.payments.map((p) => p.payer)).size;
  const secondsLeft = invoice.deadline - nowSec;
  const signals: string[] = [];
  let score = progress - 50;

  signals.push(`${Math.min(progress, 100)}% funded`);
  if (payers >= 3) {
    score += 20;
    signals.push(`${payers} unique payers`);
  } else if (payers === 0) {
    score -= 20;
    signals.push("No payers yet");
  }
  if (secondsLeft <= 0) {
    score -= 40;
    signals.push("Deadline passed");
  } else if (secondsLeft < 86_400 && progress < 100) {
    score -= 20;
    signals.push("Less than 24h left");
  }

  score = Math.max(-100, Math.min(100, score));
  const label: SentimentLabel = score >= 20 ? "positive" : score <= -20 ? "negative" : "neutral";
  return { label, score, signals };
}

const STYLES: Record<SentimentLabel, { text: string; emoji: string; name: string }> = {
  positive: { text: "text-green-400", emoji: "😊", name: "Positive" },
  neutral: { text: "text-yellow-400", emoji: "😐", name: "Neutral" },
  negative: { text: "text-red-400", emoji: "😟", name: "Negative" },
};

export default function InvoiceSentiment({ invoice }: { invoice: Invoice }) {
  const { label, score, signals } = analyzeInvoiceSentiment(invoice);
  const style = STYLES[label];

  return (
    <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-6" aria-labelledby="sentiment-heading">
      <h2 id="sentiment-heading" className="text-lg font-semibold text-white mb-3">
        Sentiment
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {style.emoji}
        </span>
        <span className={`text-xl font-bold ${style.text}`} data-testid="sentiment-label">
          {style.name}
        </span>
        <span className="text-sm text-gray-400">score {score}</span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {signals.map((s) => (
          <li key={s} className="rounded-full bg-gray-700 px-3 py-1 text-xs text-gray-200">
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}
