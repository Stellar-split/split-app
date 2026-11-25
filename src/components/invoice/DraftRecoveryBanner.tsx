"use client";

interface Props {
  updatedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

function relativeTime(timestamp: number): string {
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minute(s) ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour(s) ago`;
  return `${Math.floor(diff / 86400)} day(s) ago`;
}

/**
 * DraftRecoveryBanner — offers to restore an invoice draft found in
 * IndexedDB from a previous session that never made it to the server.
 */
export default function DraftRecoveryBanner({ updatedAt, onRestore, onDiscard }: Props) {
  return (
    <div
      role="status"
      className="mb-6 flex items-center justify-between gap-4 flex-wrap bg-indigo-950/60 border border-indigo-700 rounded-lg px-4 py-3"
    >
      <p className="text-sm text-indigo-200">
        You have an unsaved draft from {relativeTime(updatedAt)}. Restore it?
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onRestore}
          className="min-h-9 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          Restore Draft
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="min-h-9 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
