import React, { createContext } from 'react';

export const ToastContext = createContext(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <ToastContext.Provider value={null}>{children}</ToastContext.Provider>;
}
