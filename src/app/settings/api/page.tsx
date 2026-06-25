"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { validateThemeConfig } from "@/components/EmbedThemeProvider";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: number;
}

interface ApiCall {
  keyId: string;
  endpoint: string;
  timestamp: number;
  success: boolean;
}

interface EmbedBrandingConfig {
  primaryColor: string;
  logoUrl: string;
  borderRadius: string;
}

const KEYS_STORAGE = "stellarsplit_api_keys";
const USAGE_STORAGE = "stellarsplit_api_usage";
const BRANDING_STORAGE = "stellarsplit_embed_branding";
const RATE_LIMIT = 60;

function loadKeys(): ApiKey[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "[]"); }
  catch { return []; }
}

function loadUsage(): ApiCall[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(USAGE_STORAGE) ?? "[]"); }
  catch { return []; }
}

function loadBranding(): EmbedBrandingConfig {
  if (typeof window === "undefined") return { primaryColor: "", logoUrl: "", borderRadius: "" };
  try {
    return JSON.parse(localStorage.getItem(BRANDING_STORAGE) ?? '{"primaryColor":"","logoUrl":"","borderRadius":""}');
  }
  catch { return { primaryColor: "", logoUrl: "", borderRadius: "" }; }
}

function saveBranding(config: EmbedBrandingConfig): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(BRANDING_STORAGE, JSON.stringify(config)); }
  catch { /* ignore */ }
}

export default function ApiDashboardPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<ApiCall[]>([]);
  const [branding, setBranding] = useState<EmbedBrandingConfig>({
    primaryColor: "",
    logoUrl: "",
    borderRadius: "",
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setKeys(loadKeys());
    setUsage(loadUsage());
    setBranding(loadBranding());
  }, []);

  const handleBrandingChange = (field: keyof EmbedBrandingConfig, value: string) => {
    const updated = { ...branding, [field]: value };
    setBranding(updated);
    saveBranding(updated);
  };

  const generateEmbedUrl = (invoiceId: string = "INVOICE_ID"): string => {
    const baseUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/embed/${invoiceId}`;
    const params = new URLSearchParams();

    if (branding.primaryColor) {
      params.append("primaryColor", branding.primaryColor);
    }
    if (branding.logoUrl) {
      params.append("logoUrl", branding.logoUrl);
    }
    if (branding.borderRadius) {
      params.append("borderRadius", branding.borderRadius);
    }

    return params.toString() ? `${baseUrl}?${params}` : baseUrl;
  };

  const copyEmbedUrl = async () => {
    const url = generateEmbedUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearHistory = () => {
    localStorage.removeItem(USAGE_STORAGE);
    setUsage([]);
  };

  const oneHourAgo = Date.now() - 3_600_000;
  const callsThisHour = usage.filter((c) => c.timestamp > oneHourAgo).length;
  const ratePct = Math.min(100, Math.round((callsThisHour / RATE_LIMIT) * 100));

  const recent = [...usage].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 overflow-x-hidden">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← Settings
          </Link>
          <h1 className="text-2xl font-bold mt-2">API Dashboard</h1>
        </div>
        <ThemeToggle />
      </div>

      {/* Rate limit */}
      <section className="bg-gray-900 rounded-xl p-5 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-300 font-medium">Rate limit usage</span>
          <span className="text-gray-400">{callsThisHour} / {RATE_LIMIT} calls this hour</span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${ratePct >= 80 ? "bg-red-500" : ratePct >= 50 ? "bg-yellow-500" : "bg-indigo-500"}`}
            style={{ width: `${ratePct}%` }}
          />
        </div>
      </section>

      {/* Embed branding */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Embed Branding</h2>
        <div className="bg-gray-900 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-300 font-medium mb-2">
              Primary Color (hex)
            </label>
            <input
              type="text"
              placeholder="#4f46e5"
              value={branding.primaryColor}
              onChange={(e) => handleBrandingChange("primaryColor", e.target.value)}
              maxLength={7}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Applied to buttons and interactive elements. Defaults to #4f46e5 if invalid.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 font-medium mb-2">
              Logo URL (HTTPS only)
            </label>
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={branding.logoUrl}
              onChange={(e) => handleBrandingChange("logoUrl", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Rendered above the invoice amount. Only HTTPS URLs accepted.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 font-medium mb-2">
              Border Radius (CSS value)
            </label>
            <input
              type="text"
              placeholder="0.5rem"
              value={branding.borderRadius}
              onChange={(e) => handleBrandingChange("borderRadius", e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports px, rem, em, %. Defaults to 0.5rem if invalid.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-700">
            <p className="text-sm text-gray-300 font-medium mb-3">Generated Embed URL</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={generateEmbedUrl()}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400 font-mono truncate"
              />
              <button
                onClick={copyEmbedUrl}
                className={`min-h-11 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  copied
                    ? "bg-green-600/20 text-green-400"
                    : "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Replace INVOICE_ID with your actual invoice ID. All parameters are optional and fall back to defaults if invalid.
            </p>
          </div>
        </div>
      </section>
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">API Keys</h2>
        {keys.length === 0 ? (
          <p className="text-gray-400 text-sm">No API keys found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {keys.map((k) => {
              const keyCalls = usage.filter((c) => c.keyId === k.id);
              const lastUsed = keyCalls.length > 0
                ? Math.max(...keyCalls.map((c) => c.timestamp))
                : null;
              return (
                <div key={k.id} className="bg-gray-900 rounded-xl p-4 flex flex-wrap gap-3 justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{k.name}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{k.key.slice(0, 12)}…</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-gray-300">{keyCalls.length} calls</p>
                    <p className="text-xs text-gray-500">
                      {lastUsed ? `Last: ${new Date(lastUsed).toLocaleString()}` : "Never used"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent calls */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Recent Calls</h2>
          {usage.length > 0 && (
            <button
              onClick={clearHistory}
              className="min-h-11 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-semibold transition-colors"
            >
              Clear History
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-sm">No API calls recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-800/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-semibold">Endpoint</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs text-gray-400 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recent.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-gray-300 truncate max-w-[200px]">{c.endpoint}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(c.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.success ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                        {c.success ? "OK" : "Error"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
