"use client";

import { useState } from "react";
import { checkContrast } from "@/lib/contrast";
import { DEFAULT_ACCENT_COLOR, MAX_TAGLINE_LENGTH } from "@/lib/brandSettings";
import {
  BRAND_PRESETS,
  normalizeHex,
  readableTextColor,
  suggestAccessibleAccent,
} from "@/lib/brandTools";

interface Props {
  accentColor?: string | null;
  tagline?: string | null;
  onApply?: (brand: { accentColor: string; tagline: string | null }) => void;
}

export default function BrandCustomizationTools({ accentColor, tagline, onApply }: Props) {
  const [color, setColor] = useState(accentColor ?? DEFAULT_ACCENT_COLOR);
  const [text, setText] = useState(tagline ?? "");

  const normalized = normalizeHex(color);
  const contrast = normalized ? checkContrast(normalized) : null;
  const previewColor = normalized ?? DEFAULT_ACCENT_COLOR;
  const trimmedText = text.trim();
  const canApply = normalized !== null && contrast?.passes === true && trimmedText.length <= MAX_TAGLINE_LENGTH;

  return (
    <section className="space-y-4" aria-label="Brand customization tools">
      <div>
        <p className="mb-2 text-sm font-medium">Presets</p>
        <div className="flex flex-wrap gap-2">
          {BRAND_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              aria-label={`Use ${p.name} preset`}
              aria-pressed={normalized === p.accentColor}
              className="h-11 w-11 rounded-full border-2"
              style={{ backgroundColor: p.accentColor }}
              onClick={() => setColor(p.accentColor)}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Accent color
          <input
            className="mt-1 w-full rounded border px-2 py-1 font-mono"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Tagline
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            maxLength={MAX_TAGLINE_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      </div>

      <div role="status" className="text-sm">
        {contrast === null ? (
          <span>Enter a valid hex color (e.g. #4f46e5).</span>
        ) : contrast.passes ? (
          <span>Contrast {contrast.ratio.toFixed(2)}:1 — passes WCAG AA.</span>
        ) : (
          <span>
            Contrast {contrast.ratio.toFixed(2)}:1 — fails WCAG AA.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setColor(suggestAccessibleAccent(color) ?? color)}
            >
              Make accessible
            </button>
          </span>
        )}
      </div>

      <div className="rounded border p-4" data-testid="brand-preview">
        <p className="text-lg font-semibold" style={{ color: previewColor }}>
          Invoice
        </p>
        {trimmedText && <p className="text-sm text-gray-500">{trimmedText}</p>}
        <span
          className="mt-3 inline-block rounded px-4 py-2 text-sm font-medium"
          style={{ backgroundColor: previewColor, color: readableTextColor(previewColor) }}
        >
          Pay now
        </span>
      </div>

      <button
        type="button"
        disabled={!canApply}
        className="min-h-11 rounded border px-4 py-2 text-sm disabled:opacity-50"
        onClick={() => {
          if (normalized) onApply?.({ accentColor: normalized, tagline: trimmedText || null });
        }}
      >
        Apply branding
      </button>
    </section>
  );
}
