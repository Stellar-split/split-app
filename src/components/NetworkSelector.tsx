"use client";

import { useEffect, useState } from "react";
import FocusTrap from "@/components/FocusTrap";
import {
  DEFAULT_NETWORK_ID,
  checkRpcNetwork,
  describePassphrase,
  getActiveNetwork,
  getPresetNetwork,
  readNetworkPreference,
  validateCustomNetwork,
  writeNetworkPreference,
  MAINNET_PASSPHRASE,
  type CustomNetworkInput,
  type NetworkConfig,
  type NetworkId,
  type NetworkPreference,
} from "@/lib/networks";

const BADGE_STYLES: Record<NetworkId, string> = {
  mainnet: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  testnet: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  custom: "bg-violet-500/15 border-violet-500/40 text-violet-300",
};

const BADGE_ICONS: Record<NetworkId, string> = { mainnet: "🌐", testnet: "🧪", custom: "🛠" };

const EMPTY_CUSTOM: CustomNetworkInput = {
  label: "",
  passphrase: "",
  rpcUrl: "",
  horizonUrl: "",
  contractId: "",
  usdcAddress: "",
};

const CUSTOM_FIELDS: { key: keyof CustomNetworkInput; label: string; placeholder: string; required?: boolean }[] = [
  { key: "label", label: "Name", placeholder: "My local network" },
  { key: "rpcUrl", label: "Soroban RPC URL", placeholder: "https://rpc.example.org", required: true },
  { key: "horizonUrl", label: "Horizon URL", placeholder: "https://horizon.example.org", required: true },
  { key: "passphrase", label: "Network passphrase", placeholder: "Standalone Network ; February 2017", required: true },
  { key: "contractId", label: "StellarSplit contract ID", placeholder: "C..." },
  { key: "usdcAddress", label: "USDC token contract", placeholder: "C..." },
];

/** Apply a network choice. A full reload rebuilds every network-bound module. */
function applyPreference(pref: NetworkPreference | null) {
  writeNetworkPreference(pref);
  window.location.reload();
}

/**
 * NetworkSelector — always-visible badge for the active Stellar network that
 * opens a dialog to switch between Testnet, Mainnet and a custom network.
 * Switching to Mainnet needs an explicit confirmation, a custom network must
 * pass a live RPC check, and a warning is shown whenever the connected
 * Freighter wallet is on a different network than the app.
 */
export default function NetworkSelector() {
  // Render the build default on the server and first client paint, then
  // swap in the user's saved choice to avoid a hydration mismatch.
  const [active, setActive] = useState<NetworkConfig>(() => getPresetNetwork(DEFAULT_NETWORK_ID));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<NetworkId>(DEFAULT_NETWORK_ID);
  const [custom, setCustom] = useState<CustomNetworkInput>(EMPTY_CUSTOM);
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [mainnetAck, setMainnetAck] = useState(false);
  const [walletPassphrase, setWalletPassphrase] = useState<string | null>(null);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);

  useEffect(() => {
    setActive(getActiveNetwork());
  }, []);

  // Compare with the network Freighter is set to, if the extension is present.
  useEffect(() => {
    let cancelled = false;
    import("@stellar/freighter-api")
      .then(async ({ isConnected, getNetworkDetails }) => {
        const conn = await isConnected();
        if (!conn.isConnected) return;
        const details = await getNetworkDetails();
        if (!cancelled && !details.error && details.networkPassphrase) {
          setWalletPassphrase(details.networkPassphrase);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const openDialog = () => {
    const pref = readNetworkPreference();
    setSelected(active.id);
    setCustom(pref?.custom ?? EMPTY_CUSTOM);
    setCustomErrors({});
    setCheckError(null);
    setMainnetAck(false);
    setOpen(true);
  };

  const presets = (["testnet", "mainnet"] as const).map((id) => getPresetNetwork(id));
  const selectedPreset = presets.find((p) => p.id === selected);
  const switchingToMainnet = selected === "mainnet" && active.id !== "mainnet";

  const handleSave = async () => {
    setCheckError(null);
    if (selected === "custom") {
      const errors = validateCustomNetwork(custom);
      setCustomErrors(errors);
      if (Object.keys(errors).length > 0) return;
      setChecking(true);
      const result = await checkRpcNetwork(custom.rpcUrl.trim(), custom.passphrase);
      setChecking(false);
      if (!result.ok) {
        setCheckError(result.error);
        return;
      }
      applyPreference({ id: "custom", custom });
      return;
    }
    if (switchingToMainnet && !mainnetAck) return;
    applyPreference(selected === DEFAULT_NETWORK_ID ? null : { id: selected });
  };

  const mismatch = walletPassphrase !== null && walletPassphrase !== active.passphrase;
  const saveDisabled =
    checking ||
    (selected === active.id && selected !== "custom") ||
    (selectedPreset !== undefined && !selectedPreset.contractId) ||
    (switchingToMainnet && !mainnetAck);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-label={`Network: ${active.label}. Change network`}
        title={
          active.passphrase === MAINNET_PASSPHRASE
            ? `Connected to ${active.label} — real assets`
            : `Connected to ${active.label} — test assets only`
        }
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide transition-colors hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${BADGE_STYLES[active.id]}`}
      >
        <span aria-hidden="true">{BADGE_ICONS[active.id]}</span>
        <span>{active.label}</span>
        <span aria-hidden="true" className="opacity-60">▾</span>
      </button>

      {mismatch && !mismatchDismissed && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9998] flex w-[calc(100%-2rem)] max-w-xl items-start gap-3 rounded-lg border border-amber-600 bg-amber-950/95 px-4 py-3 text-sm text-amber-100 shadow-lg"
        >
          <span aria-hidden="true">⚠</span>
          <p className="flex-1">
            Your Freighter wallet is on <strong>{describePassphrase(walletPassphrase!)}</strong> but StellarSplit is
            using <strong>{active.label}</strong>. Switch one of them so they match before signing anything.
          </p>
          <button
            type="button"
            onClick={() => setMismatchDismissed(true)}
            aria-label="Dismiss network mismatch warning"
            className="shrink-0 text-amber-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="network-dialog-title"
          onClick={() => setOpen(false)}
        >
          <FocusTrap onClose={() => setOpen(false)}>
            <div
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="network-dialog-title" className="text-lg font-semibold text-white">
                  Stellar network
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-xl leading-none text-gray-400 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                >
                  ×
                </button>
              </div>

              <p className="mb-4 text-sm text-gray-400">
                Currently using <strong className="text-gray-200">{active.label}</strong>. Your choice is saved in this
                browser and the page reloads when you switch.
              </p>

              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Choose a network</legend>
                {[...presets, { id: "custom" as const, label: "Custom", contractId: "x" }].map((n) => {
                  const unavailable = n.id !== "custom" && !n.contractId;
                  return (
                    <label
                      key={n.id}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                        selected === n.id ? "border-indigo-500 bg-indigo-950/40" : "border-gray-700"
                      } ${unavailable ? "opacity-60" : "cursor-pointer"}`}
                    >
                      <input
                        type="radio"
                        name="network"
                        value={n.id}
                        checked={selected === n.id}
                        disabled={unavailable}
                        onChange={() => {
                          setSelected(n.id);
                          setCheckError(null);
                        }}
                        className="mt-1"
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-gray-100">
                          {BADGE_ICONS[n.id]} {n.label}
                          {n.id === active.id && <span className="ml-2 text-xs text-gray-400">(current)</span>}
                        </span>
                        <span className="text-xs text-gray-400">
                          {n.id === "mainnet" && "Real assets. Payments cannot be reversed."}
                          {n.id === "testnet" && "Test assets with no real value. Safe for trying things out."}
                          {n.id === "custom" && "Your own RPC and Horizon, e.g. a local or private network."}
                          {unavailable && " Not configured for this deployment."}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              {selected === "custom" && (
                <div className="mt-4 flex flex-col gap-3">
                  {CUSTOM_FIELDS.map((f) => (
                    <div key={f.key} className="flex flex-col gap-1">
                      <label htmlFor={`custom-${f.key}`} className="text-xs font-medium text-gray-300">
                        {f.label}
                        {f.required && <span className="ml-1 text-red-500">*</span>}
                      </label>
                      <input
                        id={`custom-${f.key}`}
                        type="text"
                        value={custom[f.key] ?? ""}
                        onChange={(e) => setCustom((c) => ({ ...c, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        aria-invalid={!!customErrors[f.key]}
                        aria-describedby={customErrors[f.key] ? `custom-${f.key}-error` : undefined}
                        className={`min-h-10 rounded-lg border bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          customErrors[f.key] ? "border-red-500" : "border-gray-700"
                        }`}
                      />
                      {customErrors[f.key] && (
                        <p id={`custom-${f.key}-error`} className="text-xs text-red-400">
                          {customErrors[f.key]}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-gray-500">
                    We check that the RPC reports the same passphrase before switching.
                  </p>
                </div>
              )}

              {switchingToMainnet && (
                <label className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
                  <input
                    type="checkbox"
                    checked={mainnetAck}
                    onChange={(e) => setMainnetAck(e.target.checked)}
                    className="mt-1"
                  />
                  I understand Mainnet uses real funds and transactions cannot be undone.
                </label>
              )}

              {checkError && (
                <p role="alert" className="mt-3 text-sm text-red-400">
                  {checkError}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                {readNetworkPreference() ? (
                  <button
                    type="button"
                    onClick={() => applyPreference(null)}
                    className="text-xs text-gray-400 underline hover:text-gray-200"
                  >
                    Reset to default ({getPresetNetwork(DEFAULT_NETWORK_ID).label})
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-10 rounded-lg bg-gray-700 px-4 text-sm font-medium hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveDisabled}
                    className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checking ? "Checking…" : "Switch network"}
                  </button>
                </div>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </>
  );
}
