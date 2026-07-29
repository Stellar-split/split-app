/**
 * Shared in-memory webhook store for demo purposes.
 * In production this would be a database table.
 */

export type WebhookEventType = "invoice.created" | "invoice.funded" | "invoice.released";

export const ALL_EVENTS: WebhookEventType[] = [
  "invoice.created",
  "invoice.funded",
  "invoice.released",
];

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEventType[];
  status: "active" | "disabled";
  createdAt: string;
  /** Hashed secret — never returned by API; only raw secret returned on create/rotate */
  secretHash: string;
}

export const webhookStore: WebhookEndpoint[] = [];
