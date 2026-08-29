import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import { subscribe, reactionCounts, type CommentEvent } from "@/lib/commentStore";

function toSseChunk(event: CommentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * SSE stream of comment/reaction events for a single invoice, so every open
 * viewer sees new comments and reactions without polling.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      unsubscribe = subscribe(params.id, (event) => {
        // Reactions can move quickly; always send the latest count snapshot.
        const toSend =
          event.type === "reaction-updated"
            ? { ...event, counts: reactionCounts(event.commentId) }
            : event;
        controller.enqueue(encoder.encode(toSseChunk(toSend)));
      });

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
