'use client';

import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export default function CopyButton({ text, className = '' }: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={copied ? 'Copied' : 'Copy'}
      title={copied ? 'Copied!' : 'Copy'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors bg-gray-700 hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${className}`}
    >
      {copied ? (
        <>
          {/* checkmark */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          {/* copy icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
