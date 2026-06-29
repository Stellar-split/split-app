'use client';

import CopyButton from './CopyButton';

interface Props {
  address: string;
  truncate?: boolean;
  showCopy?: boolean;
}

export default function WalletAddress({ address, truncate = true, showCopy = false }: Props) {
  const display = truncate ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm" title={address}>{display}</span>
      {showCopy && <CopyButton text={address} className="!px-1.5 !py-0.5 text-xs" />}
    </span>
  );
}
