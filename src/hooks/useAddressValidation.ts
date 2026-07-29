import { useCallback, useState, useEffect, useRef } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { validateFederationAddress, resolveFederationAddress } from '@/lib/stellar';

export interface AddressValidationResult {
  isValid: boolean;
  isFunded?: boolean;
  requiresMemo?: boolean;
  federationAddress?: string;
  resolvedAddress?: string;
  error?: string;
  isLoading: boolean;
  memoRequired?: boolean;
  memoId?: string;
  memoType?: string;
}

const DEBOUNCE_MS = 300;

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
export function useAddressValidation() {
  const [validationState, setValidationState] = useState<AddressValidationResult>({
    isValid: false,
    isLoading: false,
  });
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validateAddress = useCallback(async (address: string) => {
    // Cancel any pending validation requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!address.trim()) {
      setValidationState({
        isValid: false,
        isLoading: false,
      });
      return;
    }

    // Set loading state
    setValidationState((prev) => ({
      ...prev,
      isLoading: true,
    }));

    // Create new debounce timer
    const timer = setTimeout(async () => {
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
            });
            return;
          }

          try {
            const resolved = await resolveFederationAddress(address);
            if (!resolved) {
              setValidationState({
                isValid: false,
                isLoading: false,
                error: `Federation address could not be resolved. Please verify the address is correct.`,
              });
              return;
            }
            resolvedAddr = resolved;

            // Try to extract memo info from federation resolution
            try {
              const { FederationServer } = await import('@stellar/stellar-sdk');
              const federationResult = await FederationServer.resolveAddress(address);
              if (federationResult.memo_id) {
                federationMemoId = federationResult.memo_id;
              }
              if (federationResult.memo_type) {
                federationMemoType = federationResult.memo_type;
              }
            } catch {
              // Memo extraction failed, continue with address validation
            }
          } catch (error) {
            setValidationState({
              isValid: false,
              isLoading: false,
              error: 'Failed to resolve federation address',
            });
            return;
          }
        }

        // Validate G-address format using StrKey
        if (!StrKey.isValidEd25519PublicKey(resolvedAddr)) {
          setValidationState({
            isValid: false,
            isLoading: false,
            error: 'Invalid Stellar address format (must start with G)',
          });
          return;
        }

        // Check if account exists and is funded
        const { isFunded, requiresMemo } = await validateFederationAddress(resolvedAddr);

        setValidationState({
          isValid: true,
          isFunded,
          requiresMemo: requiresMemo || !!federationMemoId,
          federationAddress: isFederationAddr ? address : undefined,
          resolvedAddress: resolvedAddr,
          isLoading: false,
          memoRequired: !!federationMemoId,
          memoId: federationMemoId,
          memoType: federationMemoType,
        });
      } catch (error) {
        setValidationState({
          isValid: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Error validating address',
        });
      }
    }, DEBOUNCE_MS);

    debounceTimerRef.current = timer;
  }, []);

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
    ...validationState,
  };
}
