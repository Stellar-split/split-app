import React, { createContext, useContext } from 'react';

export interface Toast {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface ToastContextValue {
  notify: (toast: Toast) => void;
  showToast: (toast: Toast) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const notify = (toast: Toast) => {
    console.log('[Toast]', toast);
  };

  const showToast = (toast: Toast) => {
    notify(toast);
  };

  return (
    <ToastContext.Provider value={{ notify, showToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
