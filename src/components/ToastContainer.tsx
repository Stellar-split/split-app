'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Toast from './Toast';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * ToastContainer — manages a stack of toast notifications.
 * Renders toasts in the bottom-right corner with auto-dismiss.
 * 
 * Note: The project also has a ToastContext-based toast system.
 * This component provides a lightweight alternative for direct use.
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const dedupeTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const dismissTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const dedupeKey = `${message}|${type}`;
    const existingToast = toasts.find((t) => t.message === message && t.type === type);

    if (existingToast) {
      // Reset auto-dismiss timer for the existing toast
      const oldTimer = dismissTimersRef.current.get(existingToast.id);
      if (oldTimer) clearTimeout(oldTimer);

      const newTimer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== existingToast.id));
        dismissTimersRef.current.delete(existingToast.id);
      }, 5_000);
      dismissTimersRef.current.set(existingToast.id, newTimer);
      return;
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Cancel any pending dedupe timer for this key
    const pendingDedupeTimer = dedupeTimersRef.current.get(dedupeKey);
    if (pendingDedupeTimer) clearTimeout(pendingDedupeTimer);

    // Auto-dismiss after 5 seconds
    const dismissTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      dismissTimersRef.current.delete(id);
    }, 5_000);
    dismissTimersRef.current.set(id, dismissTimer);
  }, [toasts]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose addToast globally for the invoice detail page
  useEffect(() => {
    (window as any).__toastContainer = { addToast };
    return () => {
      delete (window as any).__toastContainer;
      dedupeTimersRef.current.forEach((timer) => clearTimeout(timer));
      dismissTimersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-slide-up"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => dismissToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}