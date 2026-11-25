import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  retryableStatusCodes?: number[];
}

const MAX_DELAY_MS = 30000;

const DEFAULT_OPTIONS = {
  maxRetries: 5,
  initialDelayMs: 1000,
  retryableStatusCodes: [429],
};

// Ledger hardware wallet error codes/messages that should never be retried.
const LEDGER_ERROR_PATTERNS = [
  'disconnected',
  'device disconnected',
  'no device',
  'device not found',
  'app not open',
  'app is not open',
  'stellar app',
  'locked',
  'device locked',
  'denied',
  'user rejected',
  '0x6b0c',
  '0x5515',
  '0x6985',
];

const LEDGER_ERROR_MESSAGES: Record<string, string> = {
  disconnected: 'Ledger device disconnected. Please reconnect your device and try again.',
  'no device': 'No Ledger device found. Please connect your Ledger and try again.',
  'app not open': 'Please open the Stellar app on your Ledger device and try again.',
  locked: 'Your Ledger device is locked. Please unlock it and try again.',
  denied: 'Transaction was rejected on your Ledger device.',
};

function isLedgerError(error: any): boolean {
  const message = String(error?.message || error || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();
  const code = String(error?.code || error?.statusCode || '').toLowerCase();
  const haystack = `${message} ${name} ${code}`;
  return LEDGER_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function getLedgerErrorMessage(error: any): string {
  const message = String(error?.message || error || '').toLowerCase();
  for (const [key, friendly] of Object.entries(LEDGER_ERROR_MESSAGES)) {
    if (message.includes(key)) return friendly;
  }
  return 'Ledger device error. Please check your connection and try again.';
}

export function useTransactionWithRetry(options?: RetryOptions) {
  const toast = useToast();
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const [attemptCount, setAttemptCount] = useState(0);
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const getStatusCode = (error: any): number | undefined => {
    return error?.response?.status || error?.status;
  };

  const delay = (ms: number, operationId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (abortControllers.current.get(operationId)?.signal.aborted) {
          clearInterval(checkInterval);
          reject(new Error('Transaction cancelled by user'));
          return;
        }
        if (Date.now() - startTime >= ms) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  };

  const executeWithRetry = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      operationId: string = `op-${Date.now()}-${Math.random()}`
    ): Promise<T> => {
      let lastError: Error | null = null;
      let toastId: string | null = null;

      for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
        setAttemptCount(attempt);
        try {
          // Check if user cancelled
          if (abortControllers.current.get(operationId)?.signal.aborted) {
            throw new Error('Transaction cancelled by user');
          }

          const result = await fn();
          if (toastId) toast.dismiss(toastId);
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Ledger hardware wallet errors are never retryable; surface a clear message.
          if (isLedgerError(error)) {
            if (toastId) toast.dismiss(toastId);
            toast.error(getLedgerErrorMessage(error));
            throw lastError;
          }

          const statusCode = getStatusCode(error);
          const isRetryable =
            opts.retryableStatusCodes.includes(statusCode!) &&
            attempt < opts.maxRetries;

          if (isRetryable) {
            const delayMs = Math.min(
              opts.initialDelayMs * Math.pow(2, attempt - 1),
              MAX_DELAY_MS
            );
            const countdownSeconds = Math.ceil(delayMs / 1000);

            // Show countdown toast
            const message = `Rate limited. Retrying in ${countdownSeconds}s...`;
            toastId = toast.info(message);

            // Wait with cancellation support
            try {
              await delay(delayMs, operationId);
            } catch (e) {
              if (toastId) toast.dismiss(toastId);
              throw e;
            }
          } else {
            // Non-retryable error or max retries exceeded
            const errorMsg = lastError?.message || 'Transaction failed';
            const isMaxRetries = attempt === opts.maxRetries;

            if (toastId) toast.dismiss(toastId);

            if (isMaxRetries && opts.retryableStatusCodes.includes(statusCode!)) {
              // Max retries for rate limit
              toast.error(`${errorMsg}. Please try again later.`);
            } else {
              // Other errors
              toast.error(errorMsg);
            }

            throw lastError;
          }
        }
      }

      // Should not reach here but fallback
      if (toastId) toast.dismiss(toastId);
      throw lastError || new Error('Transaction failed');
    },
    [opts, toast]
  );

  const cancel = useCallback((operationId: string) => {
    const controller = abortControllers.current.get(operationId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(operationId);
    }
  }, []);

  return { executeWithRetry, cancel, attemptCount };
}
