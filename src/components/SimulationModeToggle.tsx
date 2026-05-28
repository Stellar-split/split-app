"use client";

import { useEffect, useState } from "react";
import { getSimulationMode, setSimulationMode } from "@/lib/simulationMode";

export default function SimulationModeToggle() {
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

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() => setSimulationMode(!enabled)}
      className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors ${
        enabled
          ? "bg-yellow-900 text-yellow-300 hover:bg-yellow-800"
          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
      aria-label={`Simulation mode ${enabled ? "enabled" : "disabled"}`}
    >
      {enabled ? "🎮 SIM" : "SIM"}
    </button>
  );
}
