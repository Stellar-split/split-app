"use client";

import { useEffect, useState } from "react";
import { getSimulationMode } from "@/lib/simulationMode";

export default function SimulationBanner() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEnabled(getSimulationMode());
    setMounted(true);

    const handleChange = (e: Event) => {
      const event = e as CustomEvent;
      setEnabled(event.detail.enabled);
    };

    window.addEventListener("simulation-mode-changed", handleChange);
    return () => window.removeEventListener("simulation-mode-changed", handleChange);
  }, []);

  if (!mounted || !enabled) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-30 bg-yellow-500 text-yellow-950 px-4 py-2 text-center font-semibold text-sm">
      🎮 SIMULATION MODE — No real transactions will be sent
    </div>
  );
}
