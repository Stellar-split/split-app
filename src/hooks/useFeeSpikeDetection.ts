"use client";

import { useEffect, useRef, useState } from "react";

export interface FeeSpikeState {
  p95AcceptedFee: number | null;
  isSpike: boolean;
  loading: boolean;
  sensitivityPercent: number;
}

export function useFeeSpikeDetection(sensitivityPercent = 50): FeeSpikeState {
  const [state, setState] = useState<FeeSpikeState>({
    p95AcceptedFee: null,
    isSpike: false,
    loading: true,
    sensitivityPercent,
  });
  const historyRef = useRef<number[]>([]);

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
          const history = historyRef.current;
          const rollingAverage =
            history.length > 0
              ? history.reduce((sum, fee) => sum + fee, 0) / history.length
              : p95AcceptedFee;
          const isSpike =
            rollingAverage > 0 &&
            p95AcceptedFee > rollingAverage * (1 + sensitivityPercent / 100);
          history.push(p95AcceptedFee);
          if (history.length > 10) history.shift();
          setState({
            p95AcceptedFee,
            isSpike,
            loading: false,
            sensitivityPercent,
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
  }, [sensitivityPercent]);

  return state;
}
