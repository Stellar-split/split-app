"use client";

import React, { useMemo } from "react";

interface EmbedThemeConfig {
  primaryColor?: string;
  logoUrl?: string;
  borderRadius?: string;
}

interface EmbedThemeProviderProps {
  config: EmbedThemeConfig;
  children: React.ReactNode;
}

/**
 * Validates a hex color string.
 * @param color - The color string to validate
 * @returns true if valid hex color, false otherwise
 */
function isValidHexColor(color: string): boolean {
  if (!color.startsWith("#")) return false;
  const hex = color.slice(1);
  if (![3, 4, 6, 8].includes(hex.length)) return false;
  return /^[0-9a-f]+$/i.test(hex);
}

/**
 * Validates a logo URL - must be HTTPS.
 * @param url - The URL to validate
 * @returns true if valid HTTPS URL, false otherwise
 */
function isValidLogoUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates a CSS border-radius value.
 * @param radius - The border-radius value to validate
 * @returns true if valid CSS value, false otherwise
 */
function isValidBorderRadius(radius: string): boolean {
  if (!radius) return true; // empty is allowed (will use default)
  const validUnits = ["px", "rem", "em", "%"];
  const value = radius.trim();
  return validUnits.some((unit) => value.endsWith(unit) && !isNaN(parseFloat(value)));
}

export function validateThemeConfig(config: EmbedThemeConfig): EmbedThemeConfig {
  const validated: EmbedThemeConfig = {};

  if (config.primaryColor && isValidHexColor(config.primaryColor)) {
    validated.primaryColor = config.primaryColor;
  }

  if (config.logoUrl && isValidLogoUrl(config.logoUrl)) {
    validated.logoUrl = config.logoUrl;
  }

  if (config.borderRadius && isValidBorderRadius(config.borderRadius)) {
    validated.borderRadius = config.borderRadius;
  }

  return validated;
}

export default function EmbedThemeProvider({
  config,
  children,
}: EmbedThemeProviderProps) {
  const validated = useMemo(() => validateThemeConfig(config), [config]);

  const cssVariables = useMemo(
    () => ({
      "--embed-primary-color": validated.primaryColor || "#4f46e5",
      "--embed-border-radius": validated.borderRadius || "0.5rem",
      "--embed-logo-url": validated.logoUrl ? `url('${validated.logoUrl}')` : "none",
    } as React.CSSProperties),
    [validated]
  );

  return (
    <div style={cssVariables}>
      {children}
    </div>
  );
}
