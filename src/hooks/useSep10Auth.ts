import { useCallback, useState } from 'react';

export interface Sep10AuthState {
  authenticate: (publicKey: string) => Promise<void>;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  handleUnauthorized: () => void;
}

export function useSep10Auth(): Sep10AuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async (publicKey: string) => {
    setIsAuthenticating(true);
    setError(null);
    try {
      // Stub implementation
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const handleUnauthorized = useCallback(() => {
    setIsAuthenticated(false);
    setError(null);
  }, []);

  return { authenticate, isAuthenticated, isAuthenticating, error, handleUnauthorized };
}
