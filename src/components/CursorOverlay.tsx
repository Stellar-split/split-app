"use client";

import { truncateAddress } from "@stellar-split/sdk";

interface RemoteCursor {
  address: string;
  field: string;
  color: string;
  timestamp: number;
}

interface Props {
  cursors: RemoteCursor[];
  fieldName: string;
}

export default function CursorOverlay({ cursors, fieldName }: Props) {
  const active = cursors.filter((c) => c.field === fieldName);
  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1" aria-live="polite">
      {active.map((cursor) => (
        <div
          key={cursor.address}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{
            backgroundColor: `${cursor.color}20`,
            color: cursor.color,
            border: `1px solid ${cursor.color}40`,
          }}
          title={cursor.address}
        >
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ backgroundColor: cursor.color }}
          />
          {truncateAddress(cursor.address)}
        </div>
      ))}
    </div>
  );
}
