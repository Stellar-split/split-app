/**
 * Wallet monitoring utilities for Freighter wallet state changes.
 * Handles disconnect and account switch events.
 */

import { getFreighterPublicKey } from "./freighter";
import { getLedgerStatus, LedgerStatus } from "./ledger";

export interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  ledger?: LedgerStatus;
}

export type WalletCallback = (state: WalletState) => void;

let pollingInterval: NodeJS.Timeout | null = null;
let ledgerPollingInterval: NodeJS.Timeout | null = null;
let lastKnownAddress: string | null = null;
let lastLedgerStatus: LedgerStatus | null = null;
const callbacks: Set<WalletCallback> = new Set();

export function subscribeToWalletChanges(callback: WalletCallback): () => void {
  callbacks.add(callback);
  return () => callbacks.delete(callback);
}

export function startWalletPolling(
  interval: number = 10000
): () => void {
  if (pollingInterval) return () => stopWalletPolling();

  pollingInterval = setInterval(async () => {
    try {
      const currentAddress = await getFreighterPublicKey();

      if (!lastKnownAddress && currentAddress) {
        lastKnownAddress = currentAddress;
        notifySubscribers({ publicKey: currentAddress, isConnected: true });
      } else if (lastKnownAddress && !currentAddress) {
        lastKnownAddress = null;
        notifySubscribers({ publicKey: null, isConnected: false });
      } else if (lastKnownAddress && currentAddress !== lastKnownAddress) {
        lastKnownAddress = currentAddress;
        notifySubscribers({ publicKey: currentAddress, isConnected: true });
      }
    } catch {
      if (lastKnownAddress) {
        lastKnownAddress = null;
        notifySubscribers({ publicKey: null, isConnected: false });
      }
    }
  }, interval);

  return stopWalletPolling;
}

export function stopWalletPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

export function startLedgerPolling(
  interval: number = 10000
): () => void {
  if (ledgerPollingInterval) return () => stopLedgerPolling();

  ledgerPollingInterval = setInterval(async () => {
    try {
      const status = await getLedgerStatus();
      const changed =
        !lastLedgerStatus ||
        lastLedgerStatus.connected !== status.connected ||
        lastLedgerStatus.publicKey !== status.publicKey;

      if (changed) {
        lastLedgerStatus = status;
        notifySubscribers({
          publicKey: status.publicKey ?? lastKnownAddress,
          isConnected: status.connected || !!lastKnownAddress,
          ledger: status,
        });
      }
    } catch {
      if (lastLedgerStatus?.connected) {
        lastLedgerStatus = { connected: false, publicKey: null };
        notifySubscribers({
          publicKey: lastKnownAddress,
          isConnected: !!lastKnownAddress,
          ledger: lastLedgerStatus,
        });
      }
    }
  }, interval);

  return stopLedgerPolling;
}

export function stopLedgerPolling(): void {
  if (ledgerPollingInterval) {
    clearInterval(ledgerPollingInterval);
    ledgerPollingInterval = null;
  }
}

export function getLastLedgerStatus(): LedgerStatus | null {
  return lastLedgerStatus;
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
