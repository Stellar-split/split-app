"use client";

import { useEffect, useState } from "react";
import { truncateAddress } from "@stellar-split/sdk";

interface Viewer {
  address: string;
  timestamp: number;
}

interface Props {
  invoiceId: string;
  currentAddress: string | null;
}

const TTL_MS = 30_000;
const POLL_MS = 10_000;

export default function PresenceIndicators({ invoiceId, currentAddress }: Props) {
  const [viewers, setViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    if (!currentAddress) return;

    // Register current viewer
    const registerViewer = () => {
      const key = `invoice-viewers-${invoiceId}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]") as Viewer[];
      const filtered = existing.filter((v) => Date.now() - v.timestamp < TTL_MS);
      const updated = [
        ...filtered.filter((v) => v.address !== currentAddress),
        { address: currentAddress, timestamp: Date.now() },
      ];
      localStorage.setItem(key, JSON.stringify(updated));
    };

    // Poll for viewers
    const pollViewers = () => {
      const key = `invoice-viewers-${invoiceId}`;
      const stored = JSON.parse(localStorage.getItem(key) || "[]") as Viewer[];
      const active = stored.filter((v) => Date.now() - v.timestamp < TTL_MS);
      setViewers(active);
    };

    registerViewer();
    pollViewers();

    const registerInterval = setInterval(registerViewer, POLL_MS / 2);
    const pollInterval = setInterval(pollViewers, POLL_MS);

    return () => {
      clearInterval(registerInterval);
      clearInterval(pollInterval);
    };
  }, [invoiceId, currentAddress]);

  const displayViewers = viewers.slice(0, 5);
  const overflow = Math.max(0, viewers.length - 5);

  if (viewers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs text-gray-400">Viewing:</span>
      <div className="flex items-center gap-1">
        {displayViewers.map((viewer) => (
          <div
            key={viewer.address}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
              viewer.address === currentAddress
                ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                : "bg-gray-700 text-gray-300"
            }`}
            title={viewer.address}
          >
            {truncateAddress(viewer.address).slice(0, 2).toUpperCase()}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-600 text-gray-300">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
