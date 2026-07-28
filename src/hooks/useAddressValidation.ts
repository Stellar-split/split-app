import { useCallback, useState, useEffect } from 'react';
import { Keypair } from '@stellar/js-sdk';
import { validateFederationAddress, resolveFederationAddress } from '@/lib/stellar';

export interface AddressValidationResult {
  isValid: boolean;
  isFunded?: boolean;
  requiresMemo?: boolean;
  federationAddress?: string;
  resolvedAddress?: string;
  error?: string;
  isLoading: boolean;
}

const DEBOUNCE_MS = 300;

export function useAddressValidation() {
  const [validationState, setValidationState] = useState<AddressValidationResult>({
    isValid: false,
    isLoading: false,
  });
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const validateAddress = useCallback(
    async (address: string) => {
      // Clear previous timer
      if (debounceTimer) clearTimeout(debounceTimer);

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

          // Check if it's a federation address format (contains *)
          if (address.includes('*')) {
            isFederationAddr = true;
            const resolved = await resolveFederationAddress(address);
            if (resolved) {
              resolvedAddr = resolved;
            } else {
              setValidationState({
                isValid: false,
                isLoading: false,
                error: 'Federation address could not be resolved',
              });
              return;
            }
          }

          // Validate G-address format
          let isValidGAddress = false;
          try {
            Keypair.fromPublicKey(resolvedAddr);
            isValidGAddress = true;
          } catch {
            isValidGAddress = false;
          }

          if (!isValidGAddress) {
            setValidationState({
              isValid: false,
              isLoading: false,
              error: 'Invalid Stellar address format',
            });
            return;
          }

          // Check if account exists and is funded
          const { isFunded, requiresMemo } = await validateFederationAddress(resolvedAddr);

          setValidationState({
            isValid: true,
            isFunded,
            requiresMemo,
            federationAddress: isFederationAddr ? address : undefined,
            resolvedAddress: resolvedAddr,
            isLoading: false,
          });
        } catch (error) {
          setValidationState({
            isValid: false,
            isLoading: false,
            error: 'Error validating address',
          });
        }
      }, DEBOUNCE_MS);

      setDebounceTimer(timer);
    },
    [debounceTimer]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [debounceTimer]);

  return {
    validateAddress,
    ...validationState,
  };
}
