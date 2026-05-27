"use client";

import { useState } from "react";

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
      aria-label="Copy verification link"
    >
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}
