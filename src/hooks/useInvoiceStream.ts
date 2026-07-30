'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Invoice } from '@stellar-split/sdk';
import type { StellarSplitClient } from '@stellar-split/sdk';

export interface InvoiceStreamEvent {
  type: 'PaymentReceived' | 'InvoiceReleased' | 'InvoiceRefunded';
  /** Payer address for PaymentReceived events */
  payer?: string;
  /** Amount in stroops for PaymentReceived events */
  amount?: bigint;
  /** Raw event data */
  raw: unknown;
}

export interface UseInvoiceStreamResult {
  invoice: Invoice | null;
  latestEvent: InvoiceStreamEvent | null;
  isConnected: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Lazily import the split client to avoid side effects at module load time.
 */
async function getClient(): Promise<StellarSplitClient> {
  const { getSplitClient } = await import('@/lib/stellar');
  return getSplitClient();
}

/**
 * useInvoiceStream — React hook that wraps Soroban event subscriptions
 * to provide real-time invoice updates.
 *
 * Returns { invoice, latestEvent, isConnected, error } with live updates.
 */
export function useInvoiceStream(invoiceId: string): UseInvoiceStreamResult {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [latestEvent, setLatestEvent] = useState<InvoiceStreamEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectDelayRef = useRef(1_000);
  const mountedRef = useRef(true);
  const lastEventCursorRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    try {
      const client = await getClient();
      const inv = await client.getInvoice(invoiceId);
      if (!mountedRef.current) return;

      setInvoice(inv);
      setError(null);
      setIsConnected(true);
      reconnectDelayRef.current = 1_000;

      // Detect status changes for InvoiceReleased / InvoiceRefunded
      if (lastStatusRef.current && lastStatusRef.current !== inv.status) {
        if (inv.status === 'Released') {
          setLatestEvent({
            type: 'InvoiceReleased',
            raw: { previousStatus: lastStatusRef.current, newStatus: inv.status },
          });
        } else if (inv.status === 'Refunded') {
          setLatestEvent({
            type: 'InvoiceRefunded',
            raw: { previousStatus: lastStatusRef.current, newStatus: inv.status },
          });
        }
      }
      lastStatusRef.current = inv.status;
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setIsConnected(false);
    }
  }, [invoiceId]);

  const pollEvents = useCallback(async () => {
    try {
      const { rpc } = await import('@stellar/stellar-sdk');
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://soroban-testnet.stellar.org';
      const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });

      const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';
      if (!contractId) return;

      const params: any = {
        filters: [
          {
            type: 'contract' as any,
            contractIds: [contractId],
            topics: [
              [
                // Topic: event name as symbol e.g. "PaymentReceived", "InvoiceReleased"
                '*',
              ],
            ],
          },
        ],
        limit: 10,
      };
      // GetEventsRequest is a discriminated union: pass `cursor` only when set.
      if (lastEventCursorRef.current) {
        params.cursor = lastEventCursorRef.current;
      }
      const response = await server.getEvents(params);

      if (!mountedRef.current) return;

      if (response.events && response.events.length > 0) {
        for (const event of response.events) {
          // Update cursor to latest event (`pagingToken` is present on live
          // events at runtime but missing from the SDK union type).
          const pagingToken = (event as unknown as { pagingToken?: string }).pagingToken;
          if (pagingToken) {
            lastEventCursorRef.current = pagingToken;
          }

          // Parse event topics to determine event type
          const topics = event.topic ?? [];
          if (topics.length > 0) {
            try {
              const eventName = topics[0]?.toString() ?? '';
              if (eventName.includes('PaymentReceived')) {
                const payer = topics[1]?.toString() ?? '';
                const amountStr = topics[2]?.toString() ?? '0';
                setLatestEvent({
                  type: 'PaymentReceived',
                  payer,
                  amount: BigInt(amountStr),
                  raw: event,
                });
              } else if (eventName.includes('InvoiceReleased')) {
                setLatestEvent({
                  type: 'InvoiceReleased',
                  raw: event,
                });
              } else if (eventName.includes('InvoiceRefunded')) {
                setLatestEvent({
                  type: 'InvoiceRefunded',
                  raw: event,
                });
              }
            } catch {
              // Skip unparseable events
            }
          }
        }

        // Refresh invoice data after new events
        await fetchInvoice();
      }
    } catch {
      // Polling errors are non-fatal; we still get updates via fetchInvoice
    }
  }, [fetchInvoice]);

  // Main effect: start polling
  useEffect(() => {
    mountedRef.current = true;
    lastEventCursorRef.current = null;
    lastStatusRef.current = null;

    // Initial fetch
    fetchInvoice();

    // Start polling for invoice data
    pollRef.current = setInterval(() => {
      fetchInvoice();
    }, POLL_INTERVAL_MS);

    // Also poll for events to detect PaymentReceived
    const eventPollRef = setInterval(() => {
      pollEvents();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(eventPollRef);
    };
  }, [fetchInvoice, pollEvents]);

  // Reconnection effect: when disconnected, try to reconnect with exponential backoff
  useEffect(() => {
    if (isConnected) return;

    const retryTimer = setTimeout(() => {
      if (!mountedRef.current) return;
      fetchInvoice();
      reconnectDelayRef.current = Math.min(
        reconnectDelayRef.current * 2,
        MAX_RECONNECT_DELAY_MS
      );
    }, reconnectDelayRef.current);

    return () => clearTimeout(retryTimer);
  }, [isConnected, fetchInvoice]);

  return { invoice, latestEvent, isConnected, error };
}