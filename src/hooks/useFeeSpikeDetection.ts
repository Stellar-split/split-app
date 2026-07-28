"use client";

import { useEffect, useState } from "react";
import { NORMAL_FEE_THRESHOLD } from "@/lib/stellar";

export interface FeeSpikeState {
  p95AcceptedFee: number | null;
  isSpike: boolean;
  loading: boolean;
}

export function useFeeSpikeDetection(): FeeSpikeState {
  const [state, setState] = useState<FeeSpikeState>({
    p95AcceptedFee: null,
    isSpike: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/fees", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch fee stats");
        const json = await response.json();
        const p95AcceptedFee = Number(json.p95_accepted_fee);
        if (!cancelled) {
          setState({
            p95AcceptedFee,
            isSpike: p95AcceptedFee > NORMAL_FEE_THRESHOLD * 2,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) setState((current) => ({ ...current, loading: false }));
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void poll();
    };

    void poll();
    const intervalId = window.setInterval(poll, 60_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return state;
}
