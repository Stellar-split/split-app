"use client";

import { useEffect, useState } from "react";
import { getQueueCount } from "@/lib/offlineQueue";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "";
const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
const POLL_MS = 30_000;

type Status = "online" | "offline" | "checking";

export default function NetworkStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [queueCount, setQueueCount] = useState(0);

  async function ping() {
    if (!RPC_URL) {
      setStatus("offline");
      return;
    }
    try {
      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getLatestLedger",
          params: {},
        }),
      });
      if (res.ok) {
        setStatus("online");
        setLastPing(new Date());
      } else {
        setStatus("offline");
      }
    } catch {
      setStatus("offline");
    }
  }

  useEffect(() => {
    ping();
    const id = setInterval(ping, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function pollQueue() {
      try {
        const count = await getQueueCount();
        if (!cancelled) setQueueCount(count);
      } catch {
        // IndexedDB unavailable
      }
    }
    pollQueue();
    const id = setInterval(pollQueue, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dotColor =
    status === "online"
      ? "bg-green-400"
      : status === "offline"
        ? "bg-red-500"
        : "bg-yellow-400 animate-pulse";

  const label = NETWORK.charAt(0).toUpperCase() + NETWORK.slice(1);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span
        className={`inline-block w-2 h-2 rounded-full ${dotColor}`}
        aria-label={`RPC ${status}`}
      />
      <span>{label}</span>
      {lastPing && (
        <span title={lastPing.toLocaleTimeString()}>
          · {lastPing.toLocaleTimeString()}
        </span>
      )}
      {queueCount > 0 && (
        <span className="text-yellow-400" data-testid="queue-count">
          · {queueCount} payment{queueCount !== 1 ? "s" : ""} queued
        </span>
      )}
    </div>
  );
}
