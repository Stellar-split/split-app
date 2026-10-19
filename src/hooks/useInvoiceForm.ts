'use client';

import { useCallback, useMemo, useState } from 'react';
import { useInvoiceMeta } from './useInvoiceMeta';
import { useLineItems } from './useLineItems';

export type { LineItem } from './useLineItems';

/**
 * Validates a Stellar public key (ed25519 account address).
 * Format: 'G' followed by 55 base32 characters (A-Z, 2-7).
 */
export function isValidStellarAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  const trimmed = address.trim();
  return /^G[A-Z2-7]{55}$/.test(trimmed);
}

export interface CosignerEntry {
  address: string;
  error: string | null;
}

export interface CosignerSection {
  enabled: boolean;
  cosigners: CosignerEntry[];
  threshold: number;
  thresholdError: string | null;
  setEnabled: (enabled: boolean) => void;
  addCosigner: (address?: string) => void;
  removeCosigner: (index: number) => void;
  updateCosigner: (index: number, address: string) => void;
  setThreshold: (threshold: number) => void;
  resetCosigners: () => void;
  validateCosigners: () => boolean;
  cosignerPayload: {
    cosigners: string[];
    cosignerThreshold: number;
  } | null;
}

const DEFAULT_THRESHOLD = 1;

function createEmptyCosigner(): CosignerEntry {
  return { address: '', error: null };
}

/**
 * Manages the optional co-signer approval section of the invoice creation form:
 * address list state, threshold state, validation, and the create payload.
 */
export function useCosigners(): CosignerSection {
  const [enabled, setEnabledState] = useState(false);
  const [cosigners, setCosigners] = useState<CosignerEntry[]>([createEmptyCosigner()]);
  const [threshold, setThresholdState] = useState(DEFAULT_THRESHOLD);
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    if (!next) {
      setCosigners([createEmptyCosigner()]);
      setThresholdState(DEFAULT_THRESHOLD);
      setThresholdError(null);
    }
  }, []);

  const addCosigner = useCallback((address?: string) => {
    setCosigners((prev) => [
      ...prev,
      { address: address ?? '', error: null },
    ]);
  }, []);

  const removeCosigner = useCallback((index: number) => {
    setCosigners((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [createEmptyCosigner()];
    });
  }, []);

  const updateCosigner = useCallback((index: number, address: string) => {
    setCosigners((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      const trimmed = address.trim();
      const error =
        trimmed.length === 0
          ? null
          : isValidStellarAddress(trimmed)
            ? null
            : 'Invalid Stellar address';
      next[index] = { address: trimmed, error };
      return next;
    });
  }, []);

  const setThreshold = useCallback((next: number) => {
    setThresholdState(next);
    setThresholdError(null);
  }, []);

  const resetCosigners = useCallback(() => {
    setEnabledState(false);
    setCosigners([createEmptyCosigner()]);
    setThresholdState(DEFAULT_THRESHOLD);
    setThresholdError(null);
  }, []);

  const validateCosigners = useCallback((): boolean => {
    if (!enabled) return true;

    const filled = cosigners.map((c) => c.address.trim()).filter((a) => a.length > 0);

    if (filled.length === 0) {
      setCosigners((prev) =>
        prev.map((c) => ({ ...c, error: 'At least one co-signer address is required' })),
      );
      return false;
    }

    let addressesValid = true;
    setCosigners((prev) =>
      prev.map((c) => {
        const trimmed = c.address.trim();
        if (trimmed.length === 0) {
          return { ...c, error: 'Address is required' };
        }
        if (!isValidStellarAddress(trimmed)) {
          addressesValid = false;
          return { ...c, error: 'Invalid Stellar address' };
        }
        return { ...c, error: null };
      }),
    );

    if (!addressesValid) return false;

    const unique = new Set(filled);
    if (unique.size !== filled.length) {
      setCosigners((prev) =>
        prev.map((c) => ({ ...c, error: 'Duplicate co-signer address' })),
      );
      return false;
    }

    if (!Number.isInteger(threshold) || threshold < 1 || threshold > filled.length) {
      setThresholdError(`Threshold must be between 1 and ${filled.length}`);
      return false;
    }

    setThresholdError(null);
    return true;
  }, [enabled, cosigners, threshold]);

  const cosignerPayload = useMemo(() => {
    if (!enabled) return null;
    const addresses = cosigners
      .map((c) => c.address.trim())
      .filter((a) => a.length > 0 && isValidStellarAddress(a));
    if (addresses.length === 0) return null;
    return {
      cosigners: addresses,
      cosignerThreshold: threshold,
    };
  }, [enabled, cosigners, threshold]);

  return {
    enabled,
    cosigners,
    threshold,
    thresholdError,
    setEnabled,
    addCosigner,
    removeCosigner,
    updateCosigner,
    setThreshold,
    resetCosigners,
    validateCosigners,
    cosignerPayload,
  };
}

/**
 * Composes `useInvoiceMeta` (top-level invoice fields + validation) and
 * `useLineItems` (item CRUD, totals, reordering) into the unified API
 * existing callers already depend on. See #635.
 *
 * Also exposes the optional co-signer section (#383) via `cosigners`,
 * `cosignerThreshold`, and the `cosignerSection` helpers.
 */
export function useInvoiceForm() {
  const meta = useInvoiceMeta();
  const lineItems = useLineItems();
  const cosignerSection = useCosigners();

  return {
    ...meta,
    ...lineItems,
    cosignerSection,
    cosigners: cosignerSection.cosigners,
    cosignerThreshold: cosignerSection.threshold,
    cosignersEnabled: cosignerSection.enabled,
    setCosignersEnabled: cosignerSection.setEnabled,
    addCosigner: cosignerSection.addCosigner,
    removeCosigner: cosignerSection.removeCosigner,
    updateCosigner: cosignerSection.updateCosigner,
    setCosignerThreshold: cosignerSection.setThreshold,
    resetCosigners: cosignerSection.resetCosigners,
    validateCosigners: cosignerSection.validateCosigners,
    cosignerPayload: cosignerSection.cosignerPayload,
  };
}
