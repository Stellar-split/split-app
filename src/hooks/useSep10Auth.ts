import { useCallback, useState } from 'react';

export function useSep10Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Stub implementation
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { authenticate, isLoading, error };
}
