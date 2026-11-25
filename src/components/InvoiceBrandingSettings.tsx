"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_INVOICE_BRANDING,
  INVOICE_FONT_OPTIONS,
  loadInvoiceBranding,
  readLogoFile,
  saveInvoiceBranding,
  type InvoiceBranding,
} from "@/lib/invoiceBranding";

/**
 * Settings panel letting invoice creators customize how their
 * invoices look: logo, accent color, font and watermark. Changes are
 * previewed live and only written to storage (consumed by InvoicePDF)
 * once "Save branding" is pressed.
 */
export default function InvoiceBrandingSettings() {
  const [branding, setBranding] = useState<InvoiceBranding>(DEFAULT_INVOICE_BRANDING);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBranding(loadInvoiceBranding());
  }, []);

  const update = (patch: Partial<InvoiceBranding>) => {
    setBranding((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readLogoFile(file);
    if (!dataUrl) {
      update({});
      return;
    }
    update({ logoDataUrl: dataUrl });
  };

  const handleSave = () => {
    saveInvoiceBranding(branding);
    setSaved(true);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <label htmlFor="branding-logo" className="block text-sm font-medium mb-1">
          Logo
        </label>
        <input
          id="branding-logo"
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          aria-describedby="branding-logo-hint"
          className="block w-full text-sm"
        />
        <p id="branding-logo-hint" className="text-xs text-gray-500 mt-1">
          PNG/JPG/SVG, up to 1.5&nbsp;MB. Appears on invoice previews and exported PDFs.
        </p>
        {branding.logoDataUrl && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoDataUrl}
              alt="Uploaded invoice logo preview"
              className="h-12 w-auto rounded border border-gray-300 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={() => update({ logoDataUrl: null })}
              className="text-xs text-red-600 hover:underline"
            >
              Remove logo
            </button>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="branding-color" className="block text-sm font-medium mb-1">
          Accent color
        </label>
        <div className="flex items-center gap-3">
          <input
            id="branding-color"
            type="color"
            value={branding.accentColor}
            onChange={(e) => update({ accentColor: e.target.value })}
            className="h-9 w-14 rounded border border-gray-300 dark:border-gray-700"
          />
          <span className="text-sm font-mono">{branding.accentColor}</span>
        </div>
      </div>

      <div>
        <label htmlFor="branding-font" className="block text-sm font-medium mb-1">
          Font
        </label>
        <select
          id="branding-font"
          value={branding.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        >
          {INVOICE_FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="branding-watermark-enabled"
          type="checkbox"
          checked={branding.watermarkEnabled}
          onChange={(e) => update({ watermarkEnabled: e.target.checked })}
          className="h-4 w-4"
        />
        <label htmlFor="branding-watermark-enabled" className="text-sm font-medium">
          Show watermark on unreleased invoices
        </label>
      </div>

      {branding.watermarkEnabled && (
        <div>
          <label htmlFor="branding-watermark-text" className="block text-sm font-medium mb-1">
            Watermark text
          </label>
          <input
            id="branding-watermark-text"
            type="text"
            maxLength={24}
            value={branding.watermarkText}
            onChange={(e) => update({ watermarkText: e.target.value })}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* Live preview */}
      <div>
        <h3 className="text-sm font-medium mb-2">Preview</h3>
        <div
          className="relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 p-6 bg-white text-black"
          style={{ fontFamily: branding.fontFamily }}
        >
          {branding.watermarkEnabled && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
              <div className="transform -rotate-45 text-5xl font-bold whitespace-nowrap text-gray-800">
                {branding.watermarkText}
              </div>
            </div>
          )}
          <div className="relative z-10 flex items-center justify-between mb-4">
            {branding.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoDataUrl} alt="" className="h-10 w-auto" />
            ) : (
              <span className="text-sm text-gray-400">No logo</span>
            )}
            <span
              className="rounded px-2 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: branding.accentColor }}
            >
              Invoice #123
            </span>
          </div>
          <p className="relative z-10 text-sm text-gray-600">
            This is how your accent color, font and watermark will appear on invoice exports.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Save branding
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
