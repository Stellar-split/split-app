'use client';

import { useCallback, useMemo, useState } from 'react';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

function createLineItem(): LineItem {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: '',
    quantity: 1,
    unitPrice: 0,
  };
}

/**
 * Line-item CRUD, reordering, and totals. Split out of `useInvoiceForm`
 * (#635) so item state is testable independently of invoice metadata.
 */
export function useLineItems() {
  const [items, setItems] = useState<LineItem[]>(() => [createLineItem()]);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createLineItem()]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<Omit<LineItem, 'id'>>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const reorderItems = useCallback((fromIndex: number, toIndex: number) => {
    setItems((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return { subtotal, itemCount: items.length };
  }, [items]);

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    reorderItems,
    totals,
  };
}
