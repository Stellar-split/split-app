export type ActivityEventType =
  | "payment_received"
  | "status_change"
  | "comment"
  | "co_creator_action"
  | "milestone_condition_met"
  | "milestone_released"
  | "dispute_opened"
  | "dispute_evidence_submitted"
  | "dispute_resolved"
  | "dispute_enforced";

export interface ActivityEvent {
  eventId: string;
  invoiceId: string;
  type: ActivityEventType;
  actor: string;
  timestamp: number;
  meta: Record<string, string | number | boolean>;
}

export interface ActivityEventMessage {
  type: "event";
  event: ActivityEvent;
}

export interface ActivityEventSnapshot {
  type: "snapshot";
  events: ActivityEvent[];
}

export type ActivityFeedMessage = ActivityEventMessage | ActivityEventSnapshot;