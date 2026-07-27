import { EventEmitter } from "events";
import type { ActivityEvent, ActivityEventType } from "@/types/activity";

const MAX_EVENTS = 200;

const events: ActivityEvent[] = [];
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function generateEventId(): string {
  return `ae-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function publishActivity(
  invoiceId: string,
  type: ActivityEventType,
  actor: string,
  meta: Record<string, string | number | boolean> = {},
): ActivityEvent {
  const event: ActivityEvent = {
    eventId: generateEventId(),
    invoiceId,
    type,
    actor,
    timestamp: Date.now(),
    meta,
  };
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  emitter.emit("activity", event);
  return event;
}

export function getRecentEvents(limit = 50): ActivityEvent[] {
  return events.slice(-limit);
}

export function subscribe(listener: (event: ActivityEvent) => void): () => void {
  emitter.on("activity", listener);
  return () => {
    emitter.off("activity", listener);
  };
}

export function resetActivityStoreForTests(): void {
  events.length = 0;
  emitter.removeAllListeners();
}
