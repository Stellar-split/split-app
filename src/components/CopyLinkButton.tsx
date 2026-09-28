"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

export default function CopyLinkButton({ url }: { url: string }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <>
      <button
        type="button"
        onClick={() => copy(url)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          copied
            ? "bg-green-600 hover:bg-green-600"
            : "bg-gray-700 hover:bg-gray-600"
        }`}
        aria-label={copied ? "Copied" : "Copy verification link"}
      >
        {copied ? (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
        )}
        {copied ? "Copied!" : "Copy Link"}
      </button>

      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}
