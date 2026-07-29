"use client";

import { truncateAddress } from "@stellar-split/sdk";

interface RemotePresence {
  address: string;
  online: boolean;
  color: string;
}

interface Props {
  presences: RemotePresence[];
  currentAddress: string | null;
}

export default function PresencePill({ presences, currentAddress }: Props) {
  const online = presences.filter((p) => p.online && p.address !== currentAddress);
  if (online.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs text-gray-400">Editing:</span>
      <div className="flex items-center gap-1">
        {online.slice(0, 5).map((p) => (
          <div
            key={p.address}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2"
            style={{
              backgroundColor: p.color,
              ringColor: p.color,
            }}
            title={p.address}
          >
            {truncateAddress(p.address).slice(0, 2).toUpperCase()}
          </div>
        ))}
        {online.length > 5 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-gray-700 text-gray-300">
            +{online.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}
