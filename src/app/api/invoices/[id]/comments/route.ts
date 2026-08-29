import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  addComment,
  listComments,
  reactionCounts,
  reactorEmojis,
  type StoredComment,
} from "@/lib/commentStore";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";


function serialise(comment: StoredComment, reactorId: string | null) {
  return {
    ...comment,
    reactions: reactionCounts(comment.id),
    myReactions: reactorId ? reactorEmojis(comment.id, reactorId) : [],
  };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = request.nextUrl;
  const before = searchParams.get("before");
  const limit = searchParams.get("limit");
  const reactorId = searchParams.get("reactorId");

  const comments = listComments(params.id, {
    before: before ? Number(before) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return NextResponse.json({
    comments: comments.map((c) => serialise(c, reactorId)),
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const authorAddress = body?.authorAddress;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (typeof authorAddress !== "string" || !authorAddress) {
    return NextResponse.json(
      { error: "Sign in with a wallet to comment on this invoice." },
      { status: 401 }
    );
  }
  if (!text) {
    return NextResponse.json({ error: "Comment text is required." }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Comment is too long (max 4000 characters)." }, { status: 400 });
  }

  const comment = addComment(params.id, authorAddress, text);
  return NextResponse.json(serialise(comment, authorAddress), { status: 201 });
}
