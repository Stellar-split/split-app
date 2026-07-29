"use client";

import { useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  useActivityFeed,
  type ActivityEvent,
} from "@/hooks/useActivityFeed";
import type { ActivityEventType } from "@/types/activity";
import RelativeTime from "@/components/ui/RelativeTime";

const EVENT_TYPE_LABELS: Record<ActivityEventType, string> = {
  payment_received: "Payment",
  status_change: "Status",
  comment: "Comment",
  co_creator_action: "Co-creator",
};

const EVENT_TYPE_COLORS: Record<ActivityEventType, string> = {
  payment_received: "bg-green-500/20 text-green-400",
  status_change: "bg-blue-500/20 text-blue-400",
  comment: "bg-purple-500/20 text-purple-400",
  co_creator_action: "bg-amber-500/20 text-amber-400",
};

const EVENT_TYPE_ICONS: Record<ActivityEventType, string> = {
  payment_received: "$",
  status_change: "\u21bb",
  comment: "\u2709",
  co_creator_action: "\u2731",
};

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function describeEvent(event: ActivityEvent): string {
  const actor = truncateAddress(event.actor);
  switch (event.type) {
    case "payment_received": {
      const amount = event.meta.amount;
      const amountStr =
        typeof amount === "number"
          ? `${(amount / 10_000_000).toFixed(2)} USDC`
          : "USDC";
      return `${actor} paid ${amountStr}`;
    }
    case "status_change": {
      const from = event.meta.from ?? "Previous";
      const to = event.meta.to ?? "New";
      return `Invoice moved from ${from} to ${to}`;
    }
    case "comment":
      return `${actor} commented: "${event.meta.text ?? ""}"`;
    case "co_creator_action": {
      const action = (event.meta.action as string) ?? "updated";
      return `${actor} ${action}`;
    }
    default:
      return "Unknown event";
  }
}

function FeedItem({
  event,
  onVisible,
}: {
  event: ActivityEvent;
  onVisible: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(event.eventId);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [event.eventId, onVisible]);

  const deepLink =
    event.type === "comment" && event.meta.commentId
      ? `/invoice/${event.invoiceId}#comment-${event.meta.commentId}`
      : `/invoice/${event.invoiceId}`;

  return (
    <div ref={ref} className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 last:border-b-0">
      <Link
        href={deepLink}
        className="block hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-4 px-4 py-1 rounded-lg transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Actor avatar placeholder */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300"
            aria-hidden="true"
          >
            {event.actor.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2 py-0.5 ${EVENT_TYPE_COLORS[event.type]}`}
              >
                <span aria-hidden="true">{EVENT_TYPE_ICONS[event.type]}</span>
                {EVENT_TYPE_LABELS[event.type]}
              </span>
              <span className="text-xs text-gray-400" aria-label={`Invoice ${event.invoiceId}`}>
                #{event.invoiceId}
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {describeEvent(event)}
            </p>
            <RelativeTime iso={new Date(event.timestamp).toISOString()} className="text-xs text-gray-400" />
          </div>
        </div>
      </Link>
    </div>
  );
}

interface ActivityFeedProps {
  open: boolean;
}

const FILTER_TYPES: ActivityEventType[] = [
  "payment_received",
  "status_change",
  "comment",
  "co_creator_action",
];

export default function ActivityFeed({ open }: ActivityFeedProps) {
  const {
    events,
    unreadCount,
    isConnected,
    markManyAsRead,
    activeFilters,
    toggleFilter,
    clearFilters,
  } = useActivityFeed();

  const containerRef = useRef<HTMLDivElement>(null);

  const handleItemVisible = useCallback(
    (id: string) => {
      // Batch mark visible items as read
      const visibleIds: string[] = [id];
      if (containerRef.current) {
        const items = containerRef.current.querySelectorAll("[data-event-id]");
        items.forEach((el) => {
          const eventId = el.getAttribute("data-event-id");
          if (eventId && !id.includes(eventId)) {
            visibleIds.push(eventId);
          }
        });
      }
      markManyAsRead(visibleIds);
    },
    [markManyAsRead],
  );

  if (!open) return null;

  return (
    <div
      role="complementary"
      aria-label="Activity feed"
      className="fixed right-0 top-14 bottom-0 w-full sm:w-96 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 z-40 flex flex-col shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Activity
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 min-w-[1.25rem]">
              {unreadCount}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`}
            title={isConnected ? "Connected" : "Disconnected"}
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        {FILTER_TYPES.map((type) => {
          const active = activeFilters.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleFilter(type)}
              aria-pressed={active}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {EVENT_TYPE_LABELS[type]}
            </button>
          );
        })}
        {activeFilters.length > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Event list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto" data-testid="activity-list">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <p>No activity yet</p>
            <p className="text-xs mt-1">Events will appear here in real time</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.eventId} data-event-id={event.eventId}>
              <FeedItem event={event} onVisible={handleItemVisible} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
