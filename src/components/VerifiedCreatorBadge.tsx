'use client';

import { useEffect, useState } from 'react';
import { isVerifiedCreator } from '@/lib/attestation';

interface Props {
  address: string;
}

export default function VerifiedCreatorBadge({ address }: Props) {
  const [isVerified, setIsVerified] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsVerified(isVerifiedCreator(address));
  }, [address]);

  if (!mounted || !isVerified) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300"
      title="This creator has verified their identity"
    >
      ✓ Verified Creator
    </span>
  );
}
