import { useCallback, useState, useEffect, useRef } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { validateFederationAddress, resolveFederationAddress } from '@/lib/stellar';
import { useDebounce } from '@/hooks/useDebounce';

export type AddressValidationErrorReason = 'too_short' | 'invalid_checksum' | 'wrong_prefix' | null;

export interface AddressValidationResult {
  isValid: boolean;
  isFunded?: boolean;
  requiresMemo?: boolean;
  federationAddress?: string;
  resolvedAddress?: string;
  error?: string;
  errorReason: AddressValidationErrorReason;
  isLoading: boolean;
  memoRequired?: boolean;
  memoId?: string;
  memoType?: string;
}

export interface UseAddressValidationOptions {
  /** When true, validation runs automatically (debounced 300ms) via `onAddressChange`. */
  live?: boolean;
}

const DEBOUNCE_MS = 300;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_STORAGE_KEY = 'stellar:address-resolution-cache:v1';

interface CacheEntry {
  resolvedAddress: string;
  memoId?: string;
  memoType?: string;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

function readCacheFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    Object.entries(parsed).forEach(([key, entry]) => {
      if (entry && typeof entry.timestamp === 'number' && now - entry.timestamp < CACHE_TTL_MS) {
        memoryCache.set(key, entry);
      }
    });
  } catch {
    // Corrupt or unavailable storage: ignore and continue with empty cache
  }
}

function persistCacheToStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const now = Date.now();
    const serializable: Record<string, CacheEntry> = {};
    memoryCache.forEach((entry, key) => {
      if (now - entry.timestamp < CACHE_TTL_MS) {
        serializable[key] = entry;
      }
    });
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Storage may be full or disabled; caching is best-effort only
  }
}

function getCachedResolution(address: string): CacheEntry | null {
  const entry = memoryCache.get(address);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= CACHE_TTL_MS) {
    memoryCache.delete(address);
    return null;
  }
  return entry;
}

function setCachedResolution(address: string, entry: Omit<CacheEntry, 'timestamp'>): void {
  memoryCache.set(address, { ...entry, timestamp: Date.now() });
  persistCacheToStorage();
}

readCacheFromStorage();

/**
 * Hook for validating Stellar addresses with federation lookup and on-network verification
 * Supports:
 * - G-address format validation using StrKey
 * - Federation address resolution (e.g., alice*example.com)
 * - Account funding verification
 * - Memo requirement detection
 *
 * Includes 300ms debouncing and cleanup on unmount
 */
export function useAddressValidation(options: UseAddressValidationOptions = {}) {
  const { live = false } = options;
  const [validationState, setValidationState] = useState<AddressValidationResult>({
    isValid: false,
    isLoading: false,
    errorReason: null,
  });
  const [liveAddress, setLiveAddress] = useState('');
  const debouncedLiveAddress = useDebounce(liveAddress, DEBOUNCE_MS);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runValidation = useCallback(async (address: string) => {
    // Cancel any pending validation requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (!address.trim()) {
      setValidationState({
        isValid: false,
        isLoading: false,
        errorReason: null,
      });
      return;
    }

    // Set loading state
    setValidationState((prev) => ({
      ...prev,
      isLoading: true,
    }));

    try {
      let resolvedAddr = address;
      let isFederationAddr = false;
      let federationMemoId: string | undefined;
      let federationMemoType: string | undefined;

      // Check if it's a federation address format (contains *)
      if (address.includes('*')) {
        isFederationAddr = true;

        // Validate federation address format
        const federationParts = address.split('*');
        if (federationParts.length !== 2 || !federationParts[0] || !federationParts[1]) {
          setValidationState({
            isValid: false,
            isLoading: false,
            error: 'Invalid federation address format (use name*domain.com)',
            errorReason: null,
          });
          return;
        }

        const cached = getCachedResolution(address);
        if (cached) {
          resolvedAddr = cached.resolvedAddress;
          federationMemoId = cached.memoId;
          federationMemoType = cached.memoType;
        } else {
          try {
            const resolved = await resolveFederationAddress(address);
            if (!resolved) {
              setValidationState({
                isValid: false,
                isLoading: false,
                error: `Federation address could not be resolved. Please verify the address is correct.`,
                errorReason: null,
              });
              return;
            }
            resolvedAddr = resolved;

            // Try to extract memo info from federation resolution
            try {
              const { Federation } = await import('@stellar/stellar-sdk');
              const federationResult = await Federation.Server.resolve(address);
              if (federationResult.memo) {
                federationMemoId = federationResult.memo;
              }
              if (federationResult.memo_type) {
                federationMemoType = federationResult.memo_type;
              }
            } catch {
              // Memo extraction failed, continue with address validation
            }

            setCachedResolution(address, {
              resolvedAddress: resolvedAddr,
              memoId: federationMemoId,
              memoType: federationMemoType,
            });
          } catch {
            setValidationState({
              isValid: false,
              isLoading: false,
              error:
                'We could not reach the federation server for this address. Please check the address or try again later.',
              errorReason: null,
            });
            return;
          }
        }
      }

      // Validate G-address format using StrKey
      if (!StrKey.isValidEd25519PublicKey(resolvedAddr)) {
        let errorReason: AddressValidationErrorReason = 'invalid_checksum';
        if (!isFederationAddr) {
          if (resolvedAddr.length < 56) {
            errorReason = 'too_short';
          } else if (!resolvedAddr.startsWith('G')) {
            errorReason = 'wrong_prefix';
          }
        }
        setValidationState({
          isValid: false,
          isLoading: false,
          error: 'Invalid Stellar address format (must start with G)',
          errorReason,
        });
        return;
      }

      // Check if account exists and is funded
      let isFunded = false;
      let requiresMemo = false;
      try {
        const verification = await validateFederationAddress(resolvedAddr);
        isFunded = verification.isFunded;
        requiresMemo = verification.requiresMemo;
      } catch {
        // Network verification failed; the address format is still valid
      }

      setValidationState({
        isValid: true,
        isFunded,
        requiresMemo: requiresMemo || !!federationMemoId,
        federationAddress: isFederationAddr ? address : undefined,
        resolvedAddress: resolvedAddr,
        isLoading: false,
        errorReason: null,
        memoRequired: !!federationMemoId,
        memoId: federationMemoId,
        memoType: federationMemoType,
      });
    } catch (error) {
      setValidationState({
        isValid: false,
        isLoading: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : 'Something went wrong while validating this address. Please try again.',
        errorReason: null,
      });
    }
  }, []);

  // Explicit, debounced validation entrypoint (used when `live` is false)
  const validateAddress = useCallback(
    (address: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setValidationState((prev) => ({ ...prev, isLoading: true }));
      debounceTimerRef.current = setTimeout(() => {
        void runValidation(address);
      }, DEBOUNCE_MS);
    },
    [runValidation]
  );

  // Live mode: track keystrokes and validate the debounced value automatically
  const onAddressChange = useCallback((address: string) => {
    setLiveAddress(address);
  }, []);

  useEffect(() => {
    if (live) {
      void runValidation(debouncedLiveAddress);
    }
  }, [live, debouncedLiveAddress, runValidation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    validateAddress,
    onAddressChange,
    ...validationState,
  };
}
