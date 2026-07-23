'use client';

import { useEffect, useState, useCallback } from 'react';
import WalletAddress from './WalletAddress';

export interface InvoiceEvent {
  type:
    | 'Created'
    | 'PaymentReceived'
    | 'Funded'
    | 'Released'
    | 'RefundIssued'
    | 'DisputeRaised'
    | 'DisputeResolved'
    | 'Frozen'
    | 'Archived';
  description: string;
  actor?: string;
  timestamp: number; // unix seconds
  txHash?: string;
}

interface Props {
  invoiceId: string;
}

const STELLAR_EXPERT_BASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? 'https://stellar.expert/explorer/public/tx'
    : 'https://stellar.expert/explorer/testnet/tx';

const EVENT_META: Record<
  InvoiceEvent['type'],
  { icon: string; color: string; dot: string }
> = {
  Created: { icon: '✦', color: 'text-gray-400', dot: 'bg-gray-500' },
  PaymentReceived: { icon: '💳', color: 'text-green-400', dot: 'bg-green-500' },
  Funded: { icon: '✅', color: 'text-green-400', dot: 'bg-green-500' },
  Released: { icon: '🚀', color: 'text-green-400', dot: 'bg-green-500' },
  RefundIssued: { icon: '↩️', color: 'text-orange-400', dot: 'bg-orange-500' },
  DisputeRaised: { icon: '⚠️', color: 'text-red-400', dot: 'bg-red-500' },
  DisputeResolved: { icon: '🤝', color: 'text-green-400', dot: 'bg-green-500' },
  Frozen: { icon: '🧊', color: 'text-orange-400', dot: 'bg-orange-500' },
  Archived: { icon: '📦', color: 'text-gray-400', dot: 'bg-gray-500' },
};

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function absoluteTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

// Attempt to call SDK getInvoiceEvents — falls back to empty array if not available
async function fetchEvents(invoiceId: string, cursor?: string): Promise<{ events: InvoiceEvent[]; nextCursor?: string }> {
  try {
    const { splitClient } = await import('@/lib/stellar');
    const client = splitClient as any;
    if (typeof client.getInvoiceEvents !== 'function') return { events: [] };
    const result = await client.getInvoiceEvents(invoiceId, { cursor, limit: 20 });
    return result as { events: InvoiceEvent[]; nextCursor?: string };
  } catch {
    return { events: [] };
  }
}

export default function InvoiceTimeline({ invoiceId }: Props) {
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { events: evts, nextCursor: nc } = await fetchEvents(invoiceId);
    setEvents(evts);
    setNextCursor(nc);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  const loadOlder = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const { events: older, nextCursor: nc } = await fetchEvents(invoiceId, nextCursor);
    setEvents((prev) => [...prev, ...older]);
    setNextCursor(nc);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-2 h-2 mt-2 rounded-full bg-gray-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-48" />
              <div className="h-3 bg-gray-700 rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-gray-500 text-sm bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-6 text-center">
        No events yet.
      </p>
    );
  }

  return (
    <div>
      <ol className="relative border-l border-gray-700 ml-2 space-y-6">
        {events.map((evt, i) => {
          const meta = EVENT_META[evt.type] ?? EVENT_META.Created;
          return (
            <li key={i} className="pl-6 relative">
              {/* dot */}
              <span
                className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${meta.dot}`}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
                <span className={`font-medium text-sm ${meta.color}`}>
                  {meta.icon} {evt.type.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span
                  className="text-xs text-gray-500 cursor-default"
                  title={absoluteTime(evt.timestamp)}
                >
                  {relativeTime(evt.timestamp)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{evt.description}</p>
              {evt.actor && (
                <div className="mt-0.5">
                  <WalletAddress address={evt.actor} truncate showCopy />
                </div>
              )}
              {evt.txHash && (
                <a
                  href={`${STELLAR_EXPERT_BASE}/${evt.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:underline mt-0.5 inline-block font-mono"
                >
                  {evt.txHash.slice(0, 8)}…{evt.txHash.slice(-6)} ↗
                </a>
              )}
            </li>
          );
        })}
      </ol>

      {nextCursor && (
        <button
          type="button"
          onClick={loadOlder}
          disabled={loadingMore}
          className="mt-6 w-full py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load older events'}
        </button>
      )}
    </div>
  );
}
