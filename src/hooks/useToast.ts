export interface Toast {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export function useToast() {
  const showToast = (toast: Toast) => {
    console.log('[Toast]', toast);
  };

  return {
    success: (message: string) => showToast({ type: 'success', message }),
    error: (message: string) => showToast({ type: 'error', message }),
    info: (message: string) => showToast({ type: 'info', message }),
    showToast,
  };
}
