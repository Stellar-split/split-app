'use client';

import { useEffect, useId, useState } from 'react';
import { getAttestation, isVerifiedCreator } from '@/lib/attestation';

interface Props {
  address: string;
}

/** Format a verification timestamp as a human-readable date, e.g. "January 15, 2024". */
export function formatVerificationDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(timestamp));
}

export default function VerifiedCreatorBadge({ address }: Props) {
  const [isVerified, setIsVerified] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [verification, setVerification] = useState<{
    timestamp: number | null;
    method: string | null;
  }>({ timestamp: null, method: null });

  // `useId` contains colons in React 18; strip them so the id is a valid
  // `aria-describedby` target.
  const tooltipId = `verified-creator-tooltip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    setMounted(true);
    const verified = isVerifiedCreator(address);
    setIsVerified(verified);

    if (!verified) {
      setVerification({ timestamp: null, method: null });
      return;
    }

    const attestation = getAttestation(address);
    setVerification({
      timestamp: attestation?.timestamp ?? null,
      method: attestation?.method ?? null,
    });
  }, [address]);

  if (!mounted || !isVerified) {
    return null;
  }

  const hasVerificationDate =
    typeof verification.timestamp === 'number' &&
    Number.isFinite(verification.timestamp);
  const methodLabel = verification.method?.trim() || 'signed attestation';
  const tooltipText = hasVerificationDate
    ? `Verified via ${methodLabel} on ${formatVerificationDate(
        verification.timestamp as number,
      )}`
    : null;

  return (
    <span className="relative inline-flex group">
      <span
        tabIndex={0}
        aria-describedby={tooltipText ? tooltipId : undefined}
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
      >
        ✓ Verified Creator
      </span>

      {tooltipText && (
        <span
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 shadow-lg opacity-0 invisible transition-opacity duration-150 group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible"
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
}
