import { NextRequest } from "next/server";

interface CursorEvent {
  type: "cursor";
  address: string;
  field: string;
  timestamp: number;
}

interface PresenceEvent {
  type: "presence";
  address: string;
  online: boolean;
  timestamp: number;
}

type CollabEvent = CursorEvent | PresenceEvent;

interface SseClient {
  id: string;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  address: string | null;
}

const clients = new Map<string, SseClient[]>();

function broadcast(invoiceId: string, event: CollabEvent) {
  const invoiceClients = clients.get(invoiceId);
  if (!invoiceClients) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = new TextEncoder().encode(data);
  for (const client of invoiceClients) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // client disconnected
    }
  }
}

function prune(invoiceId: string) {
  const invoiceClients = clients.get(invoiceId);
  if (!invoiceClients) return;
  const now = Date.now();
  const active = invoiceClients.filter(
    (c) => now - c.id.split("-").map(Number)[1] < 60_000
  );
  if (active.length === 0) {
    clients.delete(invoiceId);
  } else {
    clients.set(invoiceId, active);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const { invoiceId } = params;

  const stream = new ReadableStream({
    start(controller) {
      const client: SseClient = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        controller,
        encoder: new TextEncoder(),
        address: null,
      };

      if (!clients.has(invoiceId)) {
        clients.set(invoiceId, []);
      }
      clients.get(invoiceId)!.push(client);

      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify({ type: "connected", clientId: client.id })}\n\n`)
      );

      prune(invoiceId);
    },
    cancel() {
      const invoiceClients = clients.get(invoiceId);
      if (invoiceClients) {
        const remaining = invoiceClients.filter(
          (c) => !c.controller.locked
        );
        if (remaining.length === 0) {
          clients.delete(invoiceId);
          broadcast(invoiceId, {
            type: "presence",
            address: "all",
            online: false,
            timestamp: Date.now(),
          });
        } else {
          clients.set(invoiceId, remaining);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const { invoiceId } = params;
  const body = (await request.json()) as { address?: string; field?: string; online?: boolean };

  if (!body.address) {
    return Response.json({ error: "address is required" }, { status: 400 });
  }

  if (body.field !== undefined) {
    broadcast(invoiceId, {
      type: "cursor",
      address: body.address,
      field: body.field,
      timestamp: Date.now(),
    });
  }

  if (body.online !== undefined) {
    broadcast(invoiceId, {
      type: "presence",
      address: body.address,
      online: body.online,
      timestamp: Date.now(),
    });
  }

  return Response.json({ ok: true });
}
