'use client';

import { useInvoiceMeta } from './useInvoiceMeta';
import { useLineItems } from './useLineItems';

export type { LineItem } from './useLineItems';

/**
 * Composes `useInvoiceMeta` (top-level invoice fields + validation) and
 * `useLineItems` (item CRUD, totals, reordering) into the unified API
 * existing callers already depend on. See #635.
 */
export function useInvoiceForm() {
  const meta = useInvoiceMeta();
  const lineItems = useLineItems();

  return {
    ...meta,
    ...lineItems,
  };
}
