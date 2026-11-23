"use client";

import { createContext, useContext, ReactNode } from "react";

const AccessibilityContext = createContext<any>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  return context || {};
}
