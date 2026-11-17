import React from 'react';

export type FontScale = 100 | 115 | 130;
export type Contrast = 'normal' | 'high';

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

const mockContext: AccessibilityContextValue = {
  fontScale: 100,
  setFontScale: () => {},
  reducedMotion: false,
  setReducedMotion: () => {},
  highContrast: 'normal',
  setHighContrast: () => {},
};

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useAccessibility(): AccessibilityContextValue {
  return mockContext;
}

export function getStoredAccessibilitySettings(): AccessibilitySettings {
  return {
    fontScale: 100,
    reducedMotion: false,
    highContrast: 'normal',
  };
}

export function applyAccessibilitySettings(): void {}
