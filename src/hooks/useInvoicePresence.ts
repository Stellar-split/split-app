'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CoCreatorPresence, InvoiceSectionFocus, PresenceHeartbeat } from '@/types/presence';

interface UseInvoicePresenceOptions {
  invoiceId: string;
  userId: string;
  displayName: string;
  enabled?: boolean;
}

interface UseInvoicePresenceResult {
  presenceRoster: CoCreatorPresence[];
  currentFocusedSection: InvoiceSectionFocus;
  updateFocusedSection: (section: InvoiceSectionFocus) => void;
  isConnected: boolean;
  error: string | null;
}

const HEARTBEAT_INTERVAL = 5_000; // 5 seconds
const INACTIVE_TIMEOUT = 10_000; // 10 seconds

export function useInvoicePresence(
  options: UseInvoicePresenceOptions
): UseInvoicePresenceResult {
  const { invoiceId, userId, displayName, enabled = true } = options;

  const [presenceRoster, setPresenceRoster] = useState<CoCreatorPresence[]>([]);
  const [currentFocusedSection, setCurrentFocusedSection] = useState<InvoiceSectionFocus>('details');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const reconnectDelayRef = useRef(1_000);
  const lastHeartbeatRef = useRef<number>(0);

  const sendHeartbeat = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    try {
      const heartbeat: PresenceHeartbeat = {
        userId,
        displayName,
        focusedSection: currentFocusedSection,
        timestamp: Date.now(),
      };

      // Use Server-Sent Events (SSE) for heartbeat via fetch POST
      const response = await fetch(`/api/presence/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(heartbeat),
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }

      lastHeartbeatRef.current = Date.now();
      setError(null);
      setIsConnected(true);
      reconnectDelayRef.current = 1_000;
    } catch (err) {
      if (!mountedRef.current) return;
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setIsConnected(false);
    }
  }, [invoiceId, userId, displayName, currentFocusedSection, enabled]);

  const fetchPresenceRoster = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    try {
      const response = await fetch(`/api/presence/${invoiceId}`);

      if (!response.ok) {
        throw new Error(`Fetch roster failed: ${response.status}`);
      }

      const data = await response.json();
      if (mountedRef.current && data.active) {
        setPresenceRoster(data.active);
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Non-fatal error, don't disconnect
    }
  }, [invoiceId, enabled]);

  // Main effect: connect and start heartbeat
  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;

    // Send initial heartbeat
    sendHeartbeat();

    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    // Fetch roster periodically
    const rosterIntervalRef = setInterval(() => {
      fetchPresenceRoster();
    }, HEARTBEAT_INTERVAL);

    return () => {
      mountedRef.current = false;
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      clearInterval(rosterIntervalRef);

      // Send disconnect heartbeat
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, sendHeartbeat, fetchPresenceRoster]);

  // Reconnection effect
  useEffect(() => {
    if (isConnected || !enabled) return;

    const retryTimer = setTimeout(() => {
      if (!mountedRef.current) return;
      sendHeartbeat();
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30_000);
    }, reconnectDelayRef.current);

    return () => clearTimeout(retryTimer);
  }, [isConnected, enabled, sendHeartbeat]);

  const updateFocusedSection = useCallback((section: InvoiceSectionFocus) => {
    setCurrentFocusedSection(section);
  }, []);

  return {
    presenceRoster,
    currentFocusedSection,
    updateFocusedSection,
    isConnected,
    error,
  };
}
