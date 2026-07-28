import { useCallback, useRef } from 'react';
import { useToast } from '@/contexts/ToastContext';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_OPTIONS = {
  maxRetries: 3,
  initialDelayMs: 3000,
  retryableStatusCodes: [429],
};

export function useTransactionWithRetry(options?: RetryOptions) {
  const toast = useToast();
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
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
          const statusCode = getStatusCode(error);
          const isRetryable =
            opts.retryableStatusCodes.includes(statusCode!) &&
            attempt < opts.maxRetries;

          if (isRetryable) {
            const delayMs = opts.initialDelayMs * Math.pow(2, attempt - 1);
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

  return { executeWithRetry, cancel };
}
