import { useState, useCallback } from 'react';

export type LedgerStatus = 'disconnected' | 'connecting' | 'connected' | 'locked' | 'app_not_open' | 'error';

export interface UseLedgerReturn {
  status: LedgerStatus;
  connect: (derivationPath?: string) => Promise<void>;
  disconnect: () => void;
  derivationPath: string;
  setDerivationPath: (path: string) => void;
}

export function useLedger(): UseLedgerReturn {
  const [status, setStatus] = useState<LedgerStatus>('disconnected');
  const [derivationPath, setDerivationPath] = useState("m/44'/148'/0'/0/0");

  const connect = useCallback(async (path?: string) => {
    // Stub implementation
    setStatus('disconnected');
  }, []);

  const disconnect = useCallback(() => {
    setStatus('disconnected');
  }, []);

  return {
    status,
    connect,
    disconnect,
    derivationPath,
    setDerivationPath,
  };
}
