"use client";

import { useEffect, useState } from "react";

interface Customization {
  invoiceId: string;
  title: string;
  message: string;
  accentColor: string;
}

interface Props {
  invoiceId: string;
  onCustomizationChange?: (customization: Customization) => void;
}

/**
 * Live preview card that mimics the public invoice view layout.
 * Updates immediately as the user edits settings — no save required.
 */
function InvoicePreviewCard({
  invoiceId,
  title,
  message,
  accentColor,
}: {
  invoiceId: string;
  title: string;
  message: string;
  accentColor: string;
}) {
  // Derive a readable text color (white vs. black) based on accent luminance
  const hexToRgb = (hex: string) => {
    const cleaned = hex.replace("#", "");
    const full =
      cleaned.length === 3
        ? cleaned
            .split("")
            .map((c) => c + c)
            .join("")
        : cleaned;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const relativeLuminance = (r: number, g: number, b: number) => {
    const toLinear = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };

  let accentTextColor = "#ffffff";
  try {
    const [r, g, b] = hexToRgb(accentColor);
    const lum = relativeLuminance(r, g, b);
    accentTextColor = lum > 0.179 ? "#111827" : "#ffffff";
  } catch {
    // Invalid hex — use default white
  }

  const displayTitle = title.trim() || "Invoice Preview";

  return (
    <div
      className="rounded-xl border border-gray-700 overflow-hidden bg-gray-950 shadow-lg"
      aria-label="Live invoice preview"
    >
      {/* Header band styled with accent color */}
      <div
        className="px-5 py-4"
        style={{ backgroundColor: accentColor, color: accentTextColor }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-0.5">
          Invoice
        </p>
        <h3 className="text-lg font-bold leading-tight truncate">{displayTitle}</h3>
        <p className="text-xs opacity-70 mt-1 font-mono">#{invoiceId}</p>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {message.trim() ? (
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {message}
          </p>
        ) : (
          <p className="text-sm text-gray-600 italic">No custom message set.</p>
        )}

        {/* Placeholder content blocks that mimic the invoice layout */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Recipients</span>
            <span className="font-mono">— —</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: "35%", backgroundColor: accentColor }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>35% funded</span>
            <span style={{ color: accentColor }} className="font-semibold">
              350 / 1,000 USDC
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-800">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed"
            style={{
              backgroundColor: accentColor,
              color: accentTextColor,
              opacity: 0.85,
            }}
          >
            Pay Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * CustomizationPanel — allows customizing invoice title, message, and accent color.
 * Stores customization in localStorage and shows a live preview pane that
 * reflects all branding changes in real time without requiring a save.
 *
 * Layout: side-by-side on desktop (lg+), stacked on mobile.
 */
export default function CustomizationPanel({
  invoiceId,
  onCustomizationChange,
}: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [accentColor, setAccentColor] = useState("#4f46e5");

  useEffect(() => {
    const stored = localStorage.getItem(`invoice-customization-${invoiceId}`);
    if (stored) {
      const customization = JSON.parse(stored) as Customization;
      setTitle(customization.title);
      setMessage(customization.message);
      setAccentColor(customization.accentColor);
    }
  }, [invoiceId]);

  const handleSave = () => {
    const customization: Customization = {
      invoiceId,
      title,
      message,
      accentColor,
    };
    localStorage.setItem(
      `invoice-customization-${invoiceId}`,
      JSON.stringify(customization),
    );
    onCustomizationChange?.(customization);
  };

  return (
    <section className="bg-gray-900 rounded-xl p-4 sm:p-5 mb-8">
      <h2 className="text-lg font-semibold mb-4">Customize Invoice</h2>

      {/* Two-column layout: form on left, live preview on right */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Settings form ── */}
        <div className="flex-1 space-y-4">
          <div>
            <label
              htmlFor="invoice-title"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Invoice Title
            </label>
            <input
              id="invoice-title"
              type="text"
              placeholder="e.g., Project Milestone #1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="invoice-message"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Custom Message
            </label>
            <textarea
              id="invoice-message"
              placeholder="Add a custom message for recipients..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label
              htmlFor="accent-color"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="accent-color"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border border-gray-700"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                aria-label="Accent color hex value"
                className="flex-1 min-h-11 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full min-h-11 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
          >
            Save Customization
          </button>
        </div>

        {/* ── Live preview pane ── */}
        <div className="lg:w-72 xl:w-80 shrink-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
            Live Preview
          </p>
          <InvoicePreviewCard
            invoiceId={invoiceId}
            title={title}
            message={message}
            accentColor={accentColor}
          />
        </div>
      </div>
    </section>
  );
}
