import { NextRequest, NextResponse } from "next/server";
import { getComment, isAllowedEmoji, toggleReaction, ALLOWED_EMOJIS } from "@/lib/commentStore";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const body = await request.json().catch(() => null);
  const emoji = body?.emoji;
  const reactorId = body?.reactorId;

  if (typeof reactorId !== "string" || !reactorId) {
    return NextResponse.json({ error: "reactorId is required" }, { status: 400 });
  }
  if (typeof emoji !== "string" || !isAllowedEmoji(emoji)) {
    return NextResponse.json(
      { error: `emoji must be one of: ${ALLOWED_EMOJIS.join(" ")}` },
      { status: 400 }
    );
  }
  if (!getComment(params.id, params.commentId)) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const { counts, active } = toggleReaction(params.id, params.commentId, emoji, reactorId);
  return NextResponse.json({ counts, active });
}
