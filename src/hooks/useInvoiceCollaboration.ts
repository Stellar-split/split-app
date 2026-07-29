"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface RemoteCursor {
  address: string;
  field: string;
  color: string;
  timestamp: number;
}

interface RemotePresence {
  address: string;
  online: boolean;
  color: string;
}

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

interface UseInvoiceCollaborationOptions {
  invoiceId: string;
  currentAddress: string | null;
  hasWritePermission: boolean;
  onPermissionDenied?: () => void;
}

interface UseInvoiceCollaborationResult {
  remoteCursors: RemoteCursor[];
  remotePresence: RemotePresence[];
  isConnected: boolean;
  connectionError: string | null;
  focusedField: string | null;
  setFocusedField: (field: string | null) => void;
  emitFieldBlur: () => void;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const CURSOR_TTL_MS = 5_000;
const PRESENCE_TTL_MS = 10_000;

export function useInvoiceCollaboration({
  invoiceId,
  currentAddress,
  hasWritePermission,
  onPermissionDenied,
}: UseInvoiceCollaborationOptions): UseInvoiceCollaborationResult {
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [remotePresence, setRemotePresence] = useState<RemotePresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [focusedField, setFocusedFieldState] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const hasWriteRef = useRef(hasWritePermission);

  hasWriteRef.current = hasWritePermission;

  const setFocusedField = useCallback((field: string | null) => {
    setFocusedFieldState(field);
    if (field && currentAddress) {
      fetch(`/api/collab/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: currentAddress, field }),
      }).catch(() => {});
    }
  }, [invoiceId, currentAddress]);

  const emitFieldBlur = useCallback(() => {
    if (!currentAddress) return;
    setFocusedFieldState(null);
    fetch(`/api/collab/${invoiceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: currentAddress, field: "" }),
    }).catch(() => {});
  }, [invoiceId, currentAddress]);

  const connect = useCallback(() => {
    if (!currentAddress) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (!hasWriteRef.current) {
      setConnectionError("You do not have write permission for this invoice");
      onPermissionDenied?.();
      return;
    }

    const es = new EventSource(`/api/collab/${invoiceId}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttemptRef.current = 0;

      fetch(`/api/collab/${invoiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: currentAddress, online: true }),
      }).catch(() => {});
    };

    es.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "cursor") {
          if (data.address === currentAddress) return;
          setRemoteCursors((prev) => {
            const filtered = prev.filter(
              (c) => c.address !== data.address && Date.now() - c.timestamp < CURSOR_TTL_MS
            );
            if (data.field) {
              filtered.push({
                address: data.address,
                field: data.field,
                color: colorForAddress(data.address),
                timestamp: data.timestamp,
              });
            }
            return filtered;
          });
        } else if (data.type === "presence") {
          if (data.address === currentAddress) return;
          setRemotePresence((prev) => {
            const filtered = prev.filter(
              (p) => p.address !== data.address && Date.now() - p.timestamp < PRESENCE_TTL_MS
            );
            if (data.online) {
              filtered.push({
                address: data.address,
                online: true,
                color: colorForAddress(data.address),
              });
            }
            return filtered;
          });
        }
      } catch {}
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);

      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current),
        RECONNECT_MAX_MS
      );
      reconnectAttemptRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, delay);
    };
  }, [invoiceId, currentAddress, onPermissionDenied]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    const presenceInterval = setInterval(() => {
      if (currentAddress && isConnected) {
        fetch(`/api/collab/${invoiceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: currentAddress, online: true }),
        }).catch(() => {});
      }
    }, 15_000);

    const cursorCleanup = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => prev.filter((c) => now - c.timestamp < CURSOR_TTL_MS));
      setRemotePresence((prev) => prev.filter((p) => p.online)); // keep online presence
    }, 2_000);

    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(presenceInterval);
      clearInterval(cursorCleanup);

      if (currentAddress) {
        fetch(`/api/collab/${invoiceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: currentAddress, online: false }),
        }).catch(() => {});
      }
    };
  }, [invoiceId, currentAddress, connect, isConnected]);

  return {
    remoteCursors,
    remotePresence,
    isConnected,
    connectionError,
    focusedField,
    setFocusedField,
    emitFieldBlur,
  };
}
