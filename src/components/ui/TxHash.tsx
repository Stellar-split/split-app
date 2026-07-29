'use client';

import { useState } from 'react';
import CopyButton from '@/components/CopyButton';

interface TxHashProps {
  hash: string;
  network?: 'testnet' | 'mainnet';
}

export default function TxHash({ hash, network = 'testnet' }: TxHashProps) {
  const [expanded, setExpanded] = useState(false);

  const explorerUrl =
    network === 'mainnet'
      ? `https://stellar.expert/explorer/public/tx/${hash}`
      : `https://stellar.expert/explorer/testnet/tx/${hash}`;

  if (expanded) {
    return (
      <div className="flex flex-col gap-2">
        <code className="font-mono text-xs bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded px-3 py-2 break-all text-gray-200">
          {hash}
        </code>
        <div className="flex items-center gap-2">
          <CopyButton text={hash} className="text-xs px-2 py-1" />
          <button
            onClick={() => setExpanded(false)}
            className="text-xs px-2.5 py-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Collapse
          </button>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2.5 py-1.5 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 flex items-center gap-1"
            title="View on Stellar Expert"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.343a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM15.657 14.657a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM11 17a1 1 0 102 0v-1a1 1 0 10-2 0v1zM5.343 15.657a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707zM2 10a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zM5.343 5.343a1 1 0 01-1.414 1.414l-.707-.707A1 1 0 014.636 4.636l.707.707zM10 6a4 4 0 100 8 4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4z" />
            </svg>
            Explorer
          </a>
        </div>
      </div>
    );
  }

  const truncated = `${hash.slice(0, 8)}...${hash.slice(-6)}`;

  return (
    <div className="flex items-center gap-2">
      <code className="font-mono text-xs bg-gray-800 dark:bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200 select-all">
        {truncated}
      </code>
      <button
        onClick={() => setExpanded(true)}
        className="text-xs px-2.5 py-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        title="Show full transaction hash"
      >
        Show full
      </button>
      <CopyButton text={hash} className="text-xs px-2 py-1" />
    </div>
  );
}
