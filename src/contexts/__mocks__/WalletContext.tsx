import React from 'react';

export interface WalletContextValue {
  address: string;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<{ signedXdr: string }>;
}

const mockContext: WalletContextValue = {
  address: 'GTEST123456789',
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
  signTransaction: async (xdr: string) => ({ signedXdr: xdr }),
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useWalletContext(): WalletContextValue {
  return mockContext;
}
