"use client";

import { useState } from "react";

interface Props {
  invoiceId: string;
  fundedPct: number;
  verifyUrl: string;
}

export default function ShareButtons({ invoiceId, fundedPct, verifyUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const tweetText = `Invoice #${invoiceId} is ${fundedPct}% funded on @StellarSplit — verify: ${verifyUrl}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm transition-colors"
        aria-label="Share on Twitter"
      >
        Share on Twitter
      </a>
      <a
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-sm transition-colors"
        aria-label="Share on LinkedIn"
      >
        Share on LinkedIn
      </a>
      <button
        onClick={handleCopyLink}
        className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
        aria-label="Copy verification link"
      >
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
