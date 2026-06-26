export interface WebhookFieldSchema {
  name: string;
  type: string; // e.g., "string", "number", "boolean", "object", "array"
  description: string;
  required: boolean;
}

export interface WebhookEventSchema {
  eventType: string;
  description: string;
  fields: WebhookFieldSchema[];
  example: Record<string, unknown>;
}

export const WEBHOOK_SCHEMAS: WebhookEventSchema[] = [
  {
    eventType: "payment_received",
    description: "Fired when a payment is made toward an invoice.",
    fields: [
      { name: "event", type: "string", description: "The event type identifier.", required: true },
      { name: "invoiceId", type: "string", description: "The unique invoice identifier.", required: true },
      { name: "payer", type: "string", description: "Stellar address of the payer.", required: true },
      { name: "amount", type: "string", description: "Payment amount in stroops, formatted as string.", required: true },
      { name: "timestamp", type: "string", description: "ISO 8601 timestamp of the payment.", required: true },
      { name: "txHash", type: "string", description: "Stellar transaction hash.", required: true },
    ],
    example: {
      event: "payment_received",
      invoiceId: "INV-001",
      payer: "GBCXF...HNKO",
      amount: "100.0000000",
      timestamp: "2025-01-15T10:30:00.000Z",
      txHash: "abc123def456...",
    },
  },
  {
    eventType: "invoice_created",
    description: "Fired when a new invoice is created.",
    fields: [
      { name: "event", type: "string", description: "The event type identifier.", required: true },
      { name: "invoiceId", type: "string", description: "The unique invoice identifier.", required: true },
      { name: "creator", type: "string", description: "Stellar address of the invoice creator.", required: true },
      { name: "totalAmount", type: "string", description: "Total invoice amount in stroops.", required: true },
      { name: "recipientCount", type: "number", description: "Number of recipients.", required: true },
      { name: "deadline", type: "number", description: "Unix timestamp of the invoice deadline.", required: true },
      { name: "timestamp", type: "string", description: "ISO 8601 timestamp of creation.", required: true },
    ],
    example: {
      event: "invoice_created",
      invoiceId: "INV-001",
      creator: "GCREA...TOR1",
      totalAmount: "500.0000000",
      recipientCount: 3,
      deadline: 1737100800,
      timestamp: "2025-01-15T10:30:00.000Z",
    },
  },
  {
    eventType: "invoice_released",
    description: "Fired when an invoice is fully funded and released.",
    fields: [
      { name: "event", type: "string", description: "The event type identifier.", required: true },
      { name: "invoiceId", type: "string", description: "The unique invoice identifier.", required: true },
      { name: "creator", type: "string", description: "Stellar address of the invoice creator.", required: true },
      { name: "totalAmount", type: "string", description: "Total invoice amount.", required: true },
      { name: "paymentCount", type: "number", description: "Total number of payments received.", required: true },
      { name: "timestamp", type: "string", description: "ISO 8601 timestamp of release.", required: true },
    ],
    example: {
      event: "invoice_released",
      invoiceId: "INV-001",
      creator: "GCREA...TOR1",
      totalAmount: "500.0000000",
      paymentCount: 5,
      timestamp: "2025-01-15T10:30:00.000Z",
    },
  },
  {
    eventType: "invoice_refunded",
    description: "Fired when an invoice is refunded.",
    fields: [
      { name: "event", type: "string", description: "The event type identifier.", required: true },
      { name: "invoiceId", type: "string", description: "The unique invoice identifier.", required: true },
      { name: "creator", type: "string", description: "Stellar address of the invoice creator.", required: true },
      { name: "refundedAmount", type: "string", description: "Total amount refunded.", required: true },
      { name: "reason", type: "string", description: "Reason for the refund, if provided.", required: false },
      { name: "timestamp", type: "string", description: "ISO 8601 timestamp of refund.", required: true },
    ],
    example: {
      event: "invoice_refunded",
      invoiceId: "INV-001",
      creator: "GCREA...TOR1",
      refundedAmount: "500.0000000",
      reason: "Deadline expired",
      timestamp: "2025-01-15T10:30:00.000Z",
    },
  },
];

// Validate that all schema examples are JSON-serializable
export function validateSchemas(): boolean {
  return WEBHOOK_SCHEMAS.every((schema) => {
    try {
      JSON.stringify(schema.example);
      return true;
    } catch {
      return false;
    }
  });
}
