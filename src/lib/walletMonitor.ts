/**
 * Wallet monitoring utilities for Freighter wallet state changes.
 * Handles disconnect and account switch events.
 */

import { getFreighterPublicKey } from "./freighter";
import { getWalletConnectPublicKey } from "./walletconnect";

export type WalletType = "freighter" | "walletconnect";

export interface WalletConnection {
  address: string;
  walletType: WalletType;
}

export interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  walletType?: WalletType;
  address?: string;
}

export type WalletCallback = (state: WalletState) => void;

let pollingInterval: NodeJS.Timeout | null = null;
let lastKnownAddress: string | null = null;
const callbacks: Set<WalletCallback> = new Set();

// Tracks the last known address per wallet type for multi-wallet monitoring.
const lastKnownAddresses: Map<WalletType, string | null> = new Map();

async function getPublicKeyForWallet(walletType: WalletType): Promise<string | null> {
  switch (walletType) {
    case "freighter":
      return getFreighterPublicKey();
    case "walletconnect":
      return getWalletConnectPublicKey();
    default:
      return null;
  }
}

export function subscribeToWalletChanges(callback: WalletCallback): () => void {
  callbacks.add(callback);
  return () => callbacks.delete(callback);
}

export function startWalletPolling(
  connectionsOrInterval: WalletConnection[] | number = 10000,
  interval: number = 10000
): () => void {
  // Backward compatible: allow a single numeric interval argument.
  const connections: WalletConnection[] = Array.isArray(connectionsOrInterval)
    ? connectionsOrInterval
    : [];
  const pollInterval =
    typeof connectionsOrInterval === "number" ? connectionsOrInterval : interval;

  if (pollingInterval) return () => stopWalletPolling();

  // Seed per-wallet tracking from the provided connections.
  lastKnownAddresses.clear();
  for (const conn of connections) {
    lastKnownAddresses.set(conn.walletType, conn.address);
  }

  pollingInterval = setInterval(async () => {
    // Legacy single-wallet (Freighter) behavior when no connections provided.
    if (connections.length === 0) {
      try {
        const currentAddress = await getFreighterPublicKey();

        if (!lastKnownAddress && currentAddress) {
          lastKnownAddress = currentAddress;
          notifySubscribers({
            publicKey: currentAddress,
            isConnected: true,
            walletType: "freighter",
            address: currentAddress,
          });
        } else if (lastKnownAddress && !currentAddress) {
          lastKnownAddress = null;
          notifySubscribers({
            publicKey: null,
            isConnected: false,
            walletType: "freighter",
          });
        } else if (lastKnownAddress && currentAddress !== lastKnownAddress) {
          lastKnownAddress = currentAddress;
          notifySubscribers({
            publicKey: currentAddress,
            isConnected: true,
            walletType: "freighter",
            address: currentAddress,
          });
        }
      } catch {
        if (lastKnownAddress) {
          lastKnownAddress = null;
          notifySubscribers({
            publicKey: null,
            isConnected: false,
            walletType: "freighter",
          });
        }
      }
      return;
    }

    // Multi-wallet monitoring: poll each adapter independently.
    await Promise.all(
      connections.map(async (conn) => {
        const { walletType, address } = conn;
        try {
          const currentAddress = await getPublicKeyForWallet(walletType);
          const previous = lastKnownAddresses.get(walletType) ?? null;

          if (!previous && currentAddress) {
            lastKnownAddresses.set(walletType, currentAddress);
            notifySubscribers({
              publicKey: currentAddress,
              isConnected: true,
              walletType,
              address: currentAddress,
            });
          } else if (previous && !currentAddress) {
            lastKnownAddresses.set(walletType, null);
            notifySubscribers({
              publicKey: null,
              isConnected: false,
              walletType,
              address: previous,
            });
          } else if (previous && currentAddress !== previous) {
            lastKnownAddresses.set(walletType, currentAddress);
            notifySubscribers({
              publicKey: currentAddress,
              isConnected: true,
              walletType,
              address: currentAddress,
            });
          }
        } catch {
          const previous = lastKnownAddresses.get(walletType) ?? null;
          if (previous) {
            lastKnownAddresses.set(walletType, null);
            notifySubscribers({
              publicKey: null,
              isConnected: false,
              walletType,
              address: previous,
            });
          }
        }
      })
    );
  }, pollInterval);

  return stopWalletPolling;
}

export function stopWalletPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  lastKnownAddresses.clear();
}

function notifySubscribers(state: WalletState): void {
  callbacks.forEach((cb) => cb(state));
}

export function setLastKnownAddress(address: string | null): void {
  lastKnownAddress = address;
}

export function getLastKnownAddress(): string | null {
  return lastKnownAddress;
}

export function setLastKnownAddressForWallet(
  walletType: WalletType,
  address: string | null
): void {
  lastKnownAddresses.set(walletType, address);
}

export function getLastKnownAddressForWallet(
  walletType: WalletType
): string | null {
  return lastKnownAddresses.get(walletType) ?? null;
}
