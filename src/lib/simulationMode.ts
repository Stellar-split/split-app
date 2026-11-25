/**
 * Simulation mode utilities — stores and retrieves simulation mode state
 */

const SIMULATION_MODE_KEY = "stellar-split:simulation-mode";

export function getSimulationMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIMULATION_MODE_KEY) === "true";
}

export function setSimulationMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) {
    localStorage.setItem(SIMULATION_MODE_KEY, "true");
  } else {
    localStorage.removeItem(SIMULATION_MODE_KEY);
  }
  window.dispatchEvent(new CustomEvent("simulation-mode-changed", { detail: { enabled } }));
}
