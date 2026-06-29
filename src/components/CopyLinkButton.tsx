"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

export default function CopyLinkButton({ url }: { url: string }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <button
      onClick={() => copy(url)}
      className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      aria-label={copied ? "Copied" : "Copy verification link"}
    >
      {copied ? "Copied!" : "Copy Link"}
    </button>
  );
}
