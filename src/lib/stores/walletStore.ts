import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type WalletType = "freighter" | "walletconnect";

interface WalletState {
  address: string | null;
  walletType: WalletType | null;
  balance: bigint | null;
  balanceLoading: boolean;
  connecting: boolean;
  error: string | null;
}

interface WalletActions {
  setConnecting: (connecting: boolean) => void;
  setConnected: (address: string, walletType: WalletType) => void;
  setDisconnected: () => void;
  setBalance: (balance: bigint | null) => void;
  setBalanceLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const initialState: WalletState = {
  address: null,
  walletType: null,
  balance: null,
  balanceLoading: false,
  connecting: false,
  error: null,
};

export const useWalletStore = create<WalletState & WalletActions>()(
  devtools(
    immer((set) => ({
      ...initialState,
      setConnecting: (connecting) =>
        set((s) => { s.connecting = connecting; }, false, "wallet/setConnecting"),
      setConnected: (address, walletType) =>
        set(
          (s) => {
            s.address = address;
            s.walletType = walletType;
            s.connecting = false;
            s.error = null;
          },
          false,
          "wallet/setConnected"
        ),
      setDisconnected: () =>
        set((s) => {
          s.address = null;
          s.walletType = null;
          s.balance = null;
          s.error = null;
        }, false, "wallet/setDisconnected"),
      setBalance: (balance) =>
        set((s) => { s.balance = balance; }, false, "wallet/setBalance"),
      setBalanceLoading: (loading) =>
        set((s) => { s.balanceLoading = loading; }, false, "wallet/setBalanceLoading"),
      setError: (error) =>
        set((s) => { s.error = error; }, false, "wallet/setError"),
    })),
    {
      name: "WalletStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);
