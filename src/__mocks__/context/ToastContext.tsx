import React from 'react';

export interface ToastContextValue {
  toast: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const mockContext: ToastContextValue = {
  toast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useToast(): ToastContextValue {
  return mockContext;
}
