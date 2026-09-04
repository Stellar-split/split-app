'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Toast from './Toast';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type ToastContainerPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface ToastContainerProps {
  position?: ToastContainerPosition;
}

const POSITION_CLASSES: Record<ToastContainerPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

/**
 * ToastContainer — manages a stack of toast notifications.
 * Renders toasts at a configurable corner (default top-right) with auto-dismiss.
 *
 * Note: The project also has a ToastContext-based toast system.
 * This component provides a lightweight alternative for direct use.
 */
export default function ToastContainer({ position = 'top-right' }: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastsRef = useRef<ToastMessage[]>([]);
  const dedupeTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const dismissTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Keep ref in sync so addToast can see current toasts without stale closure
  toastsRef.current = toasts;

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const existingToast = toastsRef.current.find((t) => t.message === message && t.type === type);

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
    const newToast = { id, message, type };
    toastsRef.current = [...toastsRef.current, newToast];
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 5 seconds
    const dismissTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastsRef.current = toastsRef.current.filter((t) => t.id !== id);
      dismissTimersRef.current.delete(id);
    }, 5_000);
    dismissTimersRef.current.set(id, dismissTimer);
  }, []);

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
      className={`fixed ${POSITION_CLASSES[position]} z-50 flex flex-col gap-2 max-w-sm`}
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