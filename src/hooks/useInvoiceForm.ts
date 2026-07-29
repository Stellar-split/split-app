'use client';

import { useCallback, useState, useMemo } from 'react';

interface InvoiceFormState {
  expiryDate: string;
  timezone: string;
}

export function useInvoiceForm() {
  const [state, setState] = useState<InvoiceFormState>(() => ({
    expiryDate: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }));

  const setExpiryDate = useCallback((date: string) => {
    setState((prev) => ({ ...prev, expiryDate: date }));
  }, []);

  const setTimezone = useCallback((tz: string) => {
    setState((prev) => ({ ...prev, timezone: tz }));
  }, []);

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};

    if (state.expiryDate) {
      const date = new Date(state.expiryDate);
      if (date < new Date()) {
        errors.expiryDate = 'Expiry date cannot be in the past';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [state.expiryDate]);

  const getUtcTimestamp = useCallback((): number | null => {
    if (!state.expiryDate || !validation.isValid) {
      return null;
    }

    const localDate = new Date(state.expiryDate);
    return Math.floor(localDate.getTime() / 1000);
  }, [state.expiryDate, validation.isValid]);

  const convertToUtcIso = useCallback((): string | null => {
    if (!state.expiryDate) {
      return null;
    }

    const localDate = new Date(state.expiryDate);
    return localDate.toISOString();
  }, [state.expiryDate]);

  return {
    expiryDate: state.expiryDate,
    timezone: state.timezone,
    setExpiryDate,
    setTimezone,
    validation,
    getUtcTimestamp,
    convertToUtcIso,
  };
}
