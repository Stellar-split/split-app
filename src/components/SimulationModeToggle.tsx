"use client";

import { useEffect, useState } from "react";
import { getSimulationMode, setSimulationMode } from "@/lib/simulationMode";

export default function SimulationModeToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

  const handleToggleClick = () => {
    if (enabled) {
      // Turning simulation mode OFF (switching to live mode) — require confirmation.
      setConfirming(true);
    } else {
      // Turning simulation mode ON — safe, no confirmation needed.
      setSimulationMode(true);
    }
  };

  const handleConfirmLiveMode = () => {
    setSimulationMode(false);
    setConfirming(false);
  };

  const handleCancel = () => {
    setConfirming(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggleClick}
        className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors ${
          enabled
            ? "bg-yellow-900 text-yellow-300 hover:bg-yellow-800"
            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
        }`}
        aria-label={`Simulation mode ${enabled ? "enabled" : "disabled"}`}
      >
        {enabled ? "🎮 SIM" : "SIM"}
      </button>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="live-mode-confirm-title"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4"
        >
          <div className="w-full max-w-sm rounded-lg bg-gray-900 border border-gray-700 p-5 flex flex-col gap-4">
            <h2
              id="live-mode-confirm-title"
              className="text-sm font-semibold text-white"
            >
              Switch to live mode?
            </h2>
            <p className="text-sm text-gray-300">
              You are switching to live mode — all actions will use real
              funds.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-md text-sm font-semibold bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLiveMode}
                className="px-3 py-1.5 rounded-md text-sm font-semibold bg-red-700 text-white hover:bg-red-600 transition-colors"
              >
                Yes, switch to live mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
