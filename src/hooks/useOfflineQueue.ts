"use client";

import { useCallback, useState } from 'react';

export interface QueuedItem {
  type: 'payment' | 'invoice' | 'subscription';
  execute: () => Promise<any>;
}

export interface UseOfflineQueueReturn {
  enqueue: (item: QueuedItem) => void;
  dequeue: () => QueuedItem | undefined;
  queue: QueuedItem[];
  processQueue: () => Promise<void>;
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const [queue, setQueue] = useState<QueuedItem[]>([]);

  const enqueue = useCallback((item: QueuedItem) => {
    setQueue((prev) => [...prev, item]);
  }, []);

  const dequeue = useCallback(() => {
    let item: QueuedItem | undefined;
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      [item, ...prev] = prev;
      return prev;
    });
    return item;
  }, []);

  const processQueue = useCallback(async () => {
    while (queue.length > 0) {
      const item = dequeue();
      if (item) {
        try {
          await item.execute();
        } catch (error) {
          console.error('Error processing queued item:', error);
          enqueue(item);
          break;
        }
      }
    }
  }, [queue.length, dequeue, enqueue]);

  return { enqueue, dequeue, queue, processQueue };
}
