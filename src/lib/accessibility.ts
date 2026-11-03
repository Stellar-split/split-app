import { createContext, useContext } from 'react';

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }: any) {
  return <div>{children}</div>;
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
}
