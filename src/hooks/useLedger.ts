import { useState, useCallback } from 'react';

export interface LedgerStatus {
  connected: boolean;
  publicKey: string | null;
}

export function useLedger() {
  const [status, setStatus] = useState<LedgerStatus>({
    connected: false,
    publicKey: null,
  });

  const connect = useCallback(async () => {
    // Stub implementation
    setStatus({ connected: false, publicKey: null });
  }, []);

  const disconnect = useCallback(() => {
    setStatus({ connected: false, publicKey: null });
  }, []);

  return {
    status,
    connect,
    disconnect,
  };
}
