"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWallet, type UseWalletReturn } from "@/hooks/useWallet";

const WalletContext = createContext<UseWalletReturn | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}

/** Access shared wallet connection state. Must be used within <WalletProvider>. */
export function useWalletContext(): UseWalletReturn {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWalletContext must be used within a WalletProvider");
  }
  return ctx;
}
