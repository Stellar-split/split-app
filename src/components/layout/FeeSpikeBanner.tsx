"use client";

import { useState } from "react";
import { stroopsToXLM } from "@/lib/formatters";
import { useFeeSpikeDetection } from "@/hooks/useFeeSpikeDetection";

export default function FeeSpikeBanner() {
  const { p95AcceptedFee, isSpike } = useFeeSpikeDetection();
  const [dismissed, setDismissed] = useState(false);

  if (!isSpike || dismissed || p95AcceptedFee === null) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-amber-100" role="alert">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          Stellar network fees are elevated. Current p95 accepted fee is{" "}
          <span className="font-semibold">{p95AcceptedFee} stroops</span>{" "}
          (<span className="font-semibold">{stroopsToXLM(p95AcceptedFee)} XLM</span>).
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="self-start rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-300"
        >
          I understand
        </button>
      </div>
    </div>
  );
}
