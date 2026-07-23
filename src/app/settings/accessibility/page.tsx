"use client";

import type { Contrast, FontScale } from "@/contexts/AccessibilityContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";

const FONT_SCALE_OPTIONS: Array<{
  value: FontScale;
  label: string;
  description: string;
}> = [
  { value: 100, label: "100%", description: "Default" },
  { value: 115, label: "115%", description: "Comfortable" },
  { value: 130, label: "130%", description: "Large" },
];

const CONTRAST_OPTIONS: Array<{
  value: Contrast;
  label: string;
  description: string;
}> = [
  { value: "normal", label: "Standard contrast", description: "Default palette" },
  { value: "high", label: "High contrast", description: "Stronger text, borders, and controls" },
];

export default function AccessibilitySettingsPage() {
  const {
    fontScale,
    setFontScale,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
  } = useAccessibility();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-3xl font-bold">Accessibility Settings</h1>
      <p className="mb-8 text-gray-400">
        Customize text size, motion, and contrast preferences.
      </p>

      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 space-y-8">
        <section aria-labelledby="font-size-heading">
          <h2 id="font-size-heading" className="mb-2 text-lg font-semibold">
            Font Size
          </h2>
          <p className="mb-4 text-sm text-gray-400">Choose your preferred app-wide text scale.</p>

          <div className="grid gap-3 sm:grid-cols-3">
            {FONT_SCALE_OPTIONS.map((option) => {
              const selected = fontScale === option.value;

              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                    selected
                      ? "border-indigo-500 bg-indigo-950 text-white"
                      : "border-gray-700 bg-gray-800 text-gray-100 hover:border-gray-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="font-scale"
                    value={option.value}
                    checked={selected}
                    onChange={() => setFontScale(option.value)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{option.label}</span>
                  <span className="mt-1 block text-sm text-gray-400">{option.description}</span>
                </label>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800 p-4">
            <p className="text-sm">
              Preview text is currently displayed at {fontScale}% of the default size.
            </p>
          </div>
        </section>

        <section aria-labelledby="motion-heading" className="border-t border-gray-700 pt-8">
          <h2 id="motion-heading" className="mb-4 text-lg font-semibold">
            Motion
          </h2>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-700 bg-gray-800 p-4">
            <div>
              <p className="font-medium">Reduce Motion</p>
              <p className="mt-1 text-sm text-gray-400">
                Disable animations and transitions throughout the app.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReducedMotion(!reducedMotion)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                reducedMotion ? "bg-indigo-600" : "bg-gray-700"
              }`}
              role="switch"
              aria-checked={reducedMotion}
              aria-label="Toggle reduced motion"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  reducedMotion ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </section>

        <section aria-labelledby="contrast-heading" className="border-t border-gray-700 pt-8">
          <h2 id="contrast-heading" className="mb-2 text-lg font-semibold">
            Contrast
          </h2>
          <p className="mb-4 text-sm text-gray-400">Choose your preferred contrast level.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {CONTRAST_OPTIONS.map((option) => {
              const selected = highContrast === option.value;

              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                    selected
                      ? "border-indigo-500 bg-indigo-950 text-white"
                      : "border-gray-700 bg-gray-800 text-gray-100 hover:border-gray-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="contrast"
                    value={option.value}
                    checked={selected}
                    onChange={() => setHighContrast(option.value)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{option.label}</span>
                  <span className="mt-1 block text-sm text-gray-400">{option.description}</span>
                </label>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
