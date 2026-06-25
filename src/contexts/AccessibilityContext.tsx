"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type FontScale = 100 | 115 | 130;
export type Contrast = "normal" | "high";

export interface AccessibilitySettings {
  fontScale: FontScale;
  reducedMotion: boolean;
  highContrast: Contrast;
}

interface AccessibilityContextValue extends AccessibilitySettings {
  setFontScale: (scale: FontScale) => void;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (contrast: Contrast) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

const STORAGE_KEY = "accessibility-settings";

const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontScale: 100,
  reducedMotion: false,
  highContrast: "normal",
};

const FONT_SCALES: FontScale[] = [100, 115, 130];

function normalizeSettings(settings: Partial<AccessibilitySettings> | null): AccessibilitySettings {
  return {
    fontScale: FONT_SCALES.includes(settings?.fontScale as FontScale)
      ? (settings?.fontScale as FontScale)
      : DEFAULT_SETTINGS.fontScale,
    reducedMotion:
      typeof settings?.reducedMotion === "boolean"
        ? settings.reducedMotion
        : DEFAULT_SETTINGS.reducedMotion,
    highContrast:
      settings?.highContrast === "high" || settings?.highContrast === "normal"
        ? settings.highContrast
        : DEFAULT_SETTINGS.highContrast,
  };
}

export function getStoredAccessibilitySettings(): AccessibilitySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeSettings(JSON.parse(stored));
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AccessibilitySettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  const root = document.documentElement;

  root.style.setProperty("--font-scale", `${settings.fontScale / 100}`);

  if (settings.reducedMotion) {
    root.setAttribute("data-reduced-motion", "true");
  } else {
    root.removeAttribute("data-reduced-motion");
  }

  root.setAttribute("data-contrast", settings.highContrast);
}

export function AccessibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialSettings = getStoredAccessibilitySettings();
  const [settings, setSettingsState] = useState<AccessibilitySettings>(initialSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedSettings = getStoredAccessibilitySettings();
    setSettingsState(storedSettings);
    applyAccessibilitySettings(storedSettings);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyAccessibilitySettings(settings);
    saveSettings(settings);
  }, [settings, mounted]);

  const setFontScale = useCallback((scale: FontScale) => {
    setSettingsState((prev) => ({ ...prev, fontScale: scale }));
  }, []);

  const setReducedMotion = useCallback((enabled: boolean) => {
    setSettingsState((prev) => ({ ...prev, reducedMotion: enabled }));
  }, []);

  const setHighContrast = useCallback((contrast: Contrast) => {
    setSettingsState((prev) => ({ ...prev, highContrast: contrast }));
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        ...settings,
        setFontScale,
        setReducedMotion,
        setHighContrast,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return context;
}
