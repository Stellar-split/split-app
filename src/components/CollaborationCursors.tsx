"use client";

import { useEffect, useState } from "react";
import { truncateAddress } from "@stellar-split/sdk";

interface CursorEntry {
  address: string;
  scrollY: number;
  timestamp: number;
}

interface Props {
  invoiceId: string;
  currentAddress: string | null;
}

const TTL_MS = 10_000;
const POLL_MS = 2_000;
const MINIMAP_HEIGHT = 180;

const COLOR_PALETTE = [
  "#6366f1",
  "#22d3ee",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#a78bfa",
  "#fb923c",
  "#34d399",
];

function colorForAddress(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash * 31) + address.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

export default function CollaborationCursors({ invoiceId, currentAddress }: Props) {
  const [others, setOthers] = useState<CursorEntry[]>([]);
  const [pageHeight, setPageHeight] = useState(1);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const key = `invoice-cursors-${invoiceId}`;

    const updateHeight = () =>
      setPageHeight(document.documentElement.scrollHeight || 1);

    const register = () => {
      if (!currentAddress) return;
      const stored: CursorEntry[] = JSON.parse(localStorage.getItem(key) || "[]");
      const fresh = stored.filter(
        (e) => e.address !== currentAddress && Date.now() - e.timestamp < TTL_MS
      );
      fresh.push({ address: currentAddress, scrollY: window.scrollY, timestamp: Date.now() });
      localStorage.setItem(key, JSON.stringify(fresh));
    };

    const poll = () => {
      const stored: CursorEntry[] = JSON.parse(localStorage.getItem(key) || "[]");
      const active = stored.filter(
        (e) => e.address !== currentAddress && Date.now() - e.timestamp < TTL_MS
      );
      setOthers(active);
      updateHeight();
    };

    updateHeight();
    register();
    poll();

    const onScroll = () => { register(); updateHeight(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateHeight, { passive: true });

    const interval = setInterval(() => { register(); poll(); }, POLL_MS);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateHeight);
      clearInterval(interval);
    };
  }, [invoiceId, currentAddress]);

  if (others.length === 0) return null;

  return (
    <div
      className="fixed right-2 sm:right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5"
      aria-label="Other viewers' scroll positions"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 text-xs transition-colors"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Show viewer positions" : "Hide viewer positions"}
      >
        {collapsed ? "▸" : "◂"}
      </button>

      {!collapsed && (
        <div
          role="img"
          aria-label="Minimap of viewer positions"
          className="relative bg-gray-900 border border-gray-700 rounded"
          style={{ width: 20, height: MINIMAP_HEIGHT }}
        >
          {/* Track line */}
          <div className="absolute inset-x-0 top-0 bottom-0 mx-auto w-px bg-gray-700" />

          {others.map((cursor) => {
            const topPct = Math.min((cursor.scrollY / pageHeight) * 100, 94);
            const color = colorForAddress(cursor.address);
            return (
              <div
                key={cursor.address}
                title={truncateAddress(cursor.address)}
                style={{
                  position: "absolute",
                  top: `${topPct}%`,
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: color,
                  boxShadow: `0 0 5px ${color}80`,
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>
      )}

      {!collapsed && (
        <div className="flex flex-col gap-1 items-center" aria-label="Viewer legend">
          {others.slice(0, 4).map((cursor) => (
            <div
              key={cursor.address}
              className="w-3 h-3 rounded-full"
              title={cursor.address}
              style={{ backgroundColor: colorForAddress(cursor.address) }}
            />
          ))}
          {others.length > 4 && (
            <span className="text-gray-500" style={{ fontSize: 9 }}>
              +{others.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
