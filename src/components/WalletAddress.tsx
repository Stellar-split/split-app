'use client';

import CopyButton from './CopyButton';

interface Props {
  address: string;
  truncate?: boolean;
  showCopy?: boolean;
  /** Whether the address is a valid Stellar key or successfully resolved federation address. */
  verified?: boolean;
  /** The resolved Stellar address (e.g. from a federation name). */
  resolvedAddress?: string;
  /** The original federation name (e.g. user*domain.com) if the address was resolved. */
  federationName?: string;
  /** Whether resolution failed for this address. */
  resolutionFailed?: boolean;
}

export default function WalletAddress({
  address,
  truncate = true,
  showCopy = true,
  verified = false,
  resolvedAddress,
  federationName,
  resolutionFailed = false,
}: Props) {
  const target = resolvedAddress ?? address;
  const display = truncate ? `${target.slice(0, 4)}…${target.slice(-4)}` : target;

  return (
    <span className="inline-flex items-center gap-1.5">
      {verified && (
        <span
          className="inline-flex items-center text-green-600"
          title="Verified address"
          aria-label="Verified address"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
      {resolutionFailed && (
        <span
          className="inline-flex items-center text-yellow-600"
          title="Could not resolve address"
          aria-label="Address resolution failed"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
      {federationName && (
        <span className="text-xs text-gray-500" title={federationName}>
          {federationName}
        </span>
      )}
      <span className="font-mono text-sm" title={target}>{display}</span>
      {showCopy && <CopyButton text={target} className="!px-1.5 !py-0.5 text-xs" />}
    </span>
  );
}