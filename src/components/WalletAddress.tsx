'use client';

import { useState } from 'react';

interface WalletAddressProps {
  address: string;
  /** Truncate the displayed address. Defaults to true. */
  truncate?: boolean;
  /** @deprecated use `truncate` instead. */
  short?: boolean;
  /** Show a copy-to-clipboard button. */
  showCopy?: boolean;
}

/**
 * Displays a Stellar wallet address, truncated by default, with the full
 * address in the title attribute and an optional copy button.
 */
export function WalletAddress({ address, truncate, short, showCopy }: WalletAddressProps) {
  const [copied, setCopied] = useState(false);
  const shouldTruncate = truncate ?? short ?? true;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="wallet-address inline-flex items-center">
      <span className="cursor-pointer" title={address}>
        {shouldTruncate ? `${address.slice(0, 4)}…${address.slice(-4)}` : address}
      </span>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy address"
          className="ml-2 cursor-pointer"
        >
          {copied ? 'Copied!' : '📋'}
        </button>
      )}
    </span>
  );
}

export default WalletAddress;
