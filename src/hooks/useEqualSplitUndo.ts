'use client';

import { useState, useCallback } from 'react';

interface RecipientRow {
  address: string;
  amount: string;
}

export function useEqualSplitUndo(recipients: RecipientRow[]) {
  const [previousState, setPreviousState] = useState<RecipientRow[] | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const splitEqually = useCallback(
    (totalAmount: number) => {
      if (recipients.length <= 1) return false;

      setPreviousState([...recipients]);
      setUndoCount((count) => count + 1);
      setRedoCount(0);

      const perRecipient = Math.floor(100 / recipients.length);
      const remainder = 100 - (perRecipient * recipients.length);
      const amountPerRecipient = totalAmount / recipients.length;

      const newRecipients = recipients.map((r, index) => ({
        ...r,
        amount: (amountPerRecipient).toFixed(7),
      }));

      // Assign remainder to first recipient
      if (remainder > 0 && newRecipients.length > 0) {
        const firstAmount = parseFloat(newRecipients[0].amount) + (totalAmount * remainder / 100);
        newRecipients[0].amount = firstAmount.toFixed(7);
      }

      return newRecipients;
    },
    [recipients]
  );

  const undo = useCallback(() => {
    const state = previousState;
    setPreviousState(null);
    if (state !== null) {
      setUndoCount((count) => Math.max(0, count - 1));
      setRedoCount((count) => count + 1);
    }
    return state;
  }, [previousState]);

  const hasUndo = previousState !== null;

  return { splitEqually, undo, hasUndo, undoCount, redoCount };
}
