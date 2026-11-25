import { useEffect, useState } from 'react';
import type { FreighterVersion } from '@/lib/freighterCompat';
import { parseVersion, getCompatibilityStatus } from '@/lib/freighterCompat';

export interface FreighterCompatibilityState {
  version: FreighterVersion | null;
  isLoading: boolean;
  status: 'unknown' | 'compatible' | 'deprecated' | 'unsupported';
  message: string;
  canContinue: boolean;
  breakingChange?: string;
  isDismissed: boolean;
}

/**
 * Hook to detect and validate Freighter version compatibility
 * Operates asynchronously without blocking initial render
 */
export function useFreighterCompatibility(): FreighterCompatibilityState {
  const [state, setState] = useState<FreighterCompatibilityState>({
    version: null,
    isLoading: true,
    status: 'unknown',
    message: 'Checking Freighter version...',
    canContinue: false,
    isDismissed: false,
  });

  useEffect(() => {
    const checkCompatibility = async () => {
      try {
        // Check if Freighter is available
        if (typeof window === 'undefined') {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            status: 'unknown',
            message: 'Freighter not available in server environment',
          }));
          return;
        }

        const freighterWindow = window as any;
        if (!freighterWindow.freighter) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            status: 'unknown',
            message: 'Freighter extension not detected',
            canContinue: false,
          }));
          return;
        }

        // Try to get version from Freighter
        // Note: Freighter API doesn't expose version directly, so we need to detect it
        // through feature detection or extension manifest inspection
        let detectedVersion: FreighterVersion | null = null;

        // Attempt to detect version through feature detection
        try {
          const isConnected = await freighterWindow.freighter.isConnected();
          if (isConnected) {
            // Try to get network details (v4.0+)
            const networkDetails = await freighterWindow.freighter.getNetworkDetails?.();
            if (networkDetails && networkDetails.sorobanRpcUrl) {
              // v4.0+ supports sorobanRpcUrl
              detectedVersion = parseVersion('4.0.0');
            } else {
              // Fallback to v3.x
              detectedVersion = parseVersion('3.0.0');
            }
          }
        } catch (error) {
          console.debug('Error detecting Freighter version:', error);
        }

        // If we couldn't detect the version, assume a compatible one
        if (!detectedVersion) {
          detectedVersion = parseVersion('4.0.0');
        }

        // Get compatibility status
        const compatStatus = getCompatibilityStatus(detectedVersion);

        // Check if user has dismissed the banner before (in this session)
        const isDismissed = sessionStorage.getItem('freighter-compat-dismissed') === 'true';

        setState({
          version: detectedVersion,
          isLoading: false,
          status: compatStatus.status,
          message: compatStatus.message,
          canContinue: compatStatus.canContinue,
          breakingChange: compatStatus.breakingChange,
          isDismissed,
        });
      } catch (error) {
        console.error('Error checking Freighter compatibility:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          status: 'unknown',
          message: 'Error checking Freighter compatibility',
          canContinue: true,
        }));
      }
    };

    // Run check on mount
    checkCompatibility();
  }, []);

  return state;
}

/**
 * Dismiss the compatibility banner for the current session
 */
export function dismissFreighterCompatBanner(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('freighter-compat-dismissed', 'true');
  }
}

/**
 * Reset the dismissal state (useful for testing)
 */
export function resetFreighterCompatBanner(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('freighter-compat-dismissed');
  }
}
