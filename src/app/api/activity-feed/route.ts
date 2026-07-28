import { NextRequest } from "next/server";
import { subscribe, getRecentEvents } from "@/lib/activityFeedStore";

function toSseChunk(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * SSE stream that emits all invoice activity events (payments, status
 * changes, comments, co-creator actions) to every connected dashboard client.
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send snapshot of recent events on connect
      const recent = getRecentEvents(50);
      controller.enqueue(
        encoder.encode(toSseChunk({ type: "snapshot", events: recent })),
      );

      // Subscribe to live events
      unsubscribe = subscribe((event) => {
        controller.enqueue(
          encoder.encode(toSseChunk({ type: "event", event })),
        );
      });

      // Keepalive ping every 25 seconds
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      unsubscribe?.();
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
