"use client";

import { useEffect, useRef, useState, useCallback, useReducer } from "react";
import type { ActivityEvent, ActivityEventType } from "@/types/activity";

interface ReadState {
  readIds: Set<string>;
}

type ReadAction =
  | { type: "mark_read"; id: string }
  | { type: "mark_read_batch"; ids: string[] };

function readReducer(state: ReadState, action: ReadAction): ReadState {
  switch (action.type) {
    case "mark_read": {
      if (state.readIds.has(action.id)) return state;
      const next = new Set(state.readIds);
      next.add(action.id);
      return { readIds: next };
    }
    case "mark_read_batch": {
      let changed = false;
      const next = new Set(state.readIds);
      for (const id of action.ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? { readIds: next } : state;
    }
    default:
      return state;
  }
}

export type { ActivityEvent };

export interface UseActivityFeedResult {
  events: ActivityEvent[];
  readIds: Set<string>;
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (id: string) => void;
  markManyAsRead: (ids: string[]) => void;
  activeFilters: ActivityEventType[];
  toggleFilter: (type: ActivityEventType) => void;
  clearFilters: () => void;
}

const MAX_EVENTS = 100;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function useActivityFeed(): UseActivityFeedResult {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActivityEventType[]>([]);
  const [readState, dispatchRead] = useReducer(readReducer, {
    readIds: new Set<string>(),
  });

  const mountedRef = useRef(true);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up existing connection
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    const es = new EventSource("/api/activity-feed");

    es.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data) as {
          type: string;
          events?: ActivityEvent[];
          event?: ActivityEvent;
        };

        if (msg.type === "snapshot" && msg.events) {
          setEvents((prev) => {
            const merged = [...prev];
            for (const ev of msg.events!) {
              if (!seenIdsRef.current.has(ev.eventId)) {
                seenIdsRef.current.add(ev.eventId);
                merged.push(ev);
              }
            }
            return merged.slice(-MAX_EVENTS);
          });
        } else if (msg.type === "event" && msg.event) {
          if (!seenIdsRef.current.has(msg.event.eventId)) {
            seenIdsRef.current.add(msg.event.eventId);
            setEvents((prev) => [...prev, msg.event!].slice(-MAX_EVENTS));
          }
        }

        reconnectDelayRef.current = RECONNECT_BASE_MS;
      } catch {
        // Skip unparseable messages
      }
    };

    es.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      reconnectDelayRef.current = RECONNECT_BASE_MS;
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      sourceRef.current = null;
      setIsConnected(false);

      // Reconnect with exponential backoff
      setTimeout(() => {
        if (mountedRef.current) {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            RECONNECT_MAX_MS,
          );
          connect();
        }
      }, reconnectDelayRef.current);
    };

    sourceRef.current = es;
  }, []);

  // Connect on mount, clean up on unmount
  useEffect(() => {
    mountedRef.current = true;
    seenIdsRef.current = new Set();
    connect();

    return () => {
      mountedRef.current = false;
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, [connect]);

  const markAsRead = useCallback((id: string) => {
    dispatchRead({ type: "mark_read", id });
  }, []);

  const markManyAsRead = useCallback((ids: string[]) => {
    dispatchRead({ type: "mark_read_batch", ids });
  }, []);

  const toggleFilter = useCallback((type: ActivityEventType) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((f) => f !== type) : [...prev, type],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const filteredEvents =
    activeFilters.length === 0
      ? events
      : events.filter((e) => activeFilters.includes(e.type));

  const unreadCount = filteredEvents.filter(
    (e) => !readState.readIds.has(e.eventId),
  ).length;

  return {
    events: filteredEvents,
    readIds: readState.readIds,
    unreadCount,
    isConnected,
    markAsRead,
    markManyAsRead,
    activeFilters,
    toggleFilter,
    clearFilters,
  };
}
