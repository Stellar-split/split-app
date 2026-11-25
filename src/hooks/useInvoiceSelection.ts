"use client";

import { useState, useCallback } from "react";

interface UseInvoiceSelectionResult {
  selectedIds: Set<string>;
  isSelecting: boolean;
  toggleSelecting: () => void;
  toggleInvoice: (id: string) => void;
  selectAll: (ids: string[]) => void;
  selectAllVisible: (visibleIds: string[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  selectedCount: number;
}

export function useInvoiceSelection(): UseInvoiceSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  const toggleSelecting = useCallback(() => {
    setIsSelecting((prev) => !prev);
    if (isSelecting) {
      setSelectedIds(new Set());
    }
  }, [isSelecting]);

  const toggleInvoice = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const selectAllVisible = useCallback((visibleIds: string[]) => {
    setSelectedIds(new Set(visibleIds));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return {
    selectedIds,
    isSelecting,
    toggleSelecting,
    toggleInvoice,
    selectAll,
    selectAllVisible,
    deselectAll,
    isSelected,
    selectedCount: selectedIds.size,
  };
}
