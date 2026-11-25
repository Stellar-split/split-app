"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

export type OfflineQueueItemStatus = 'pending' | 'retrying' | 'failed';

export interface OfflineQueueItem {
  id: string;
  operation: string;
  payload: unknown;
  status: OfflineQueueItemStatus;
  attempts: number;
  createdAt: number;
  lastError?: string;
}

const STORAGE_KEY = 'offline-queue:v1';
const RECONNECT_DEBOUNCE_MS = 500;

function safeParse(raw: string | null): OfflineQueueItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OfflineQueueItem =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as OfflineQueueItem).id === 'string' &&
        typeof (item as OfflineQueueItem).operation === 'string'
    );
  } catch {
    return [];
  }
}

function loadQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function persistQueue(items: OfflineQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage may be unavailable (private mode, quota); ignore.
  }
}

/**
 * Retry utility: attempts to execute a queued operation.
 * Resolves on success, rejects on failure.
 */
export async function retryOperation(item: OfflineQueueItem): Promise<void> {
  const handler = (globalThis as { __offlineQueueHandlers?: Record<string, (payload: unknown) => Promise<void>> })
    .__offlineQueueHandlers?.[item.operation];
  if (!handler) {
    throw new Error(`No handler registered for operation "${item.operation}"`);
  }
  await handler(item.payload);
}

interface Toast {
  id: number;
  message: string;
}

export default function OfflineQueueSync() {
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [draining, setDraining] = useState(false);

  const queueRef = useRef<OfflineQueueItem[]>([]);
  const drainingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef(0);
  const mountedRef = useRef(true);

  const pushToast = useCallback((message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const commit = useCallback((next: OfflineQueueItem[]) => {
    queueRef.current = next;
    persistQueue(next);
    if (mountedRef.current) setQueue(next);
  }, []);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const pending = queueRef.current.filter((item) => item.status !== 'failed');
    if (pending.length === 0) return;

    drainingRef.current = true;
    if (mountedRef.current) setDraining(true);

    for (const item of pending) {
      // Mark as retrying.
      commit(
        queueRef.current.map((q) =>
          q.id === item.id ? { ...q, status: 'retrying' as const } : q
        )
      );

      try {
        await retryOperation(item);
        // Success: remove from queue.
        commit(queueRef.current.filter((q) => q.id !== item.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        commit(
          queueRef.current.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'failed' as const,
                  attempts: q.attempts + 1,
                  lastError: message,
                }
              : q
          )
        );
      }
    }

    drainingRef.current = false;
    if (mountedRef.current) setDraining(false);
  }, [commit]);

  const scheduleDrain = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void drain();
    }, RECONNECT_DEBOUNCE_MS);
  }, [drain]);

  const handleRetryItem = useCallback(
    async (id: string) => {
      const item = queueRef.current.find((q) => q.id === id);
      if (!item) return;
      commit(
        queueRef.current.map((q) =>
          q.id === id ? { ...q, status: 'retrying' as const } : q
        )
      );
      try {
        await retryOperation(item);
        commit(queueRef.current.filter((q) => q.id !== id));
        pushToast('Queued transaction sent successfully.');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        commit(
          queueRef.current.map((q) =>
            q.id === id
              ? {
                  ...q,
                  status: 'failed' as const,
                  attempts: q.attempts + 1,
                  lastError: message,
                }
              : q
          )
        );
        pushToast('Retry failed. Transaction remains in queue.');
      }
    },
    [commit, pushToast]
  );

  const handleDiscardItem = useCallback(
    (id: string) => {
      commit(queueRef.current.filter((q) => q.id !== id));
      pushToast('Queued transaction discarded.');
    },
    [commit, pushToast]
  );

  const handleRetryAll = useCallback(() => {
    void drain();
  }, [drain]);

  const handleDiscardAll = useCallback(() => {
    commit([]);
    pushToast('All queued transactions discarded.');
  }, [commit, pushToast]);

  // Hydrate persisted queue on mount.
  useEffect(() => {
    mountedRef.current = true;
    const hydrated = loadQueue();
    queueRef.current = hydrated;
    setQueue(hydrated);

    const online =
      typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    setIsOnline(online);

    if (hydrated.length > 0) {
      pushToast(
        `${hydrated.length} queued transaction${hydrated.length === 1 ? '' : 's'} restored.`
      );
    }

    return () => {
      mountedRef.current = false;
    };
  }, [pushToast]);

  // Subscribe to connectivity changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onOnline = () => {
      setIsOnline(true);
      pushToast('Connection restored. Retrying queued transactions…');
      scheduleDrain();
    };
    const onOffline = () => {
      setIsOnline(false);
      pushToast('You are offline. Transactions will be queued.');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [pushToast, scheduleDrain]);

  // Drain on mount if online and queue has items.
  useEffect(() => {
    if (isOnline && queueRef.current.length > 0) {
      scheduleDrain();
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [isOnline, scheduleDrain]);

  const pendingCount = queue.filter((q) => q.status !== 'failed').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;

  return (
    <div className="offline-queue-sync" data-testid="offline-queue-sync">
      {!isOnline && (
        <div
          role="status"
          className="offline-queue-banner offline-queue-banner--offline"
          data-testid="offline-queue-banner"
        >
          You are offline.
          {queue.length > 0
            ? ` ${queue.length} transaction${queue.length === 1 ? '' : 's'} queued.`
            : ' Transactions will be queued.'}
        </div>
      )}

      {isOnline && queue.length > 0 && (
        <div
          role="status"
          className="offline-queue-banner offline-queue-banner--pending"
          data-testid="offline-queue-banner"
        >
          {draining
            ? 'Retrying queued transactions…'
            : `${pendingCount} pending, ${failedCount} failed queued transaction${
                queue.length === 1 ? '' : 's'
              }.`}
          <div className="offline-queue-actions">
            <button
              type="button"
              onClick={handleRetryAll}
              disabled={draining || !isOnline}
              data-testid="offline-queue-retry-all"
            >
              Retry all
            </button>
            <button
              type="button"
              onClick={handleDiscardAll}
              data-testid="offline-queue-discard-all"
            >
              Discard all
            </button>
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <ul className="offline-queue-list" data-testid="offline-queue-list">
          {queue.map((item) => (
            <li
              key={item.id}
              className={`offline-queue-item offline-queue-item--${item.status}`}
              data-testid={`offline-queue-item-${item.id}`}
            >
              <span className="offline-queue-item__label">
                {item.operation} — {item.status}
                {item.attempts > 0 ? ` (${item.attempts} attempt${item.attempts === 1 ? '' : 's'})` : ''}
              </span>
              {item.lastError && (
                <span className="offline-queue-item__error">{item.lastError}</span>
              )}
              <span className="offline-queue-item__actions">
                <button
                  type="button"
                  onClick={() => void handleRetryItem(item.id)}
                  disabled={draining || !isOnline || item.status === 'retrying'}
                  data-testid={`offline-queue-retry-${item.id}`}
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscardItem(item.id)}
                  data-testid={`offline-queue-discard-${item.id}`}
                >
                  Discard
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div
        className="offline-queue-toasts"
        aria-live="polite"
        data-testid="offline-queue-toasts"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="offline-queue-toast"
            data-testid="offline-queue-toast"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Enqueue a failed transaction for later retry.
 * Persists to storage and notifies listeners via a custom event.
 */
export function enqueueOfflineTransaction(
  operation: string,
  payload: unknown
): OfflineQueueItem {
  const item: OfflineQueueItem = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    operation,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  };
  const next = [...loadQueue(), item];
  persistQueue(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-queue:updated'));
  }
  return item;
}