import { NextRequest, NextResponse } from "next/server";
import { deleteComment, getComment } from "@/lib/commentStore";
import { getSplitClient } from "@/lib/stellar";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const body = await request.json().catch(() => null);
  const requesterAddress = body?.requesterAddress;
  const coCreatorWritePermission = body?.coCreatorWritePermission === true;

  if (typeof requesterAddress !== "string" || !requesterAddress) {
    return NextResponse.json({ error: "requesterAddress is required" }, { status: 401 });
  }

  const comment = getComment(params.id, params.commentId);
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isAuthor = comment.authorAddress === requesterAddress;

  let isCreator = false;
  try {
    const invoice = await getSplitClient().getInvoice(params.id);
    isCreator = invoice.creator === requesterAddress;
  } catch {
    // Retroactive invoices (and any invoice the server can't fetch) fall back
    // to the author/co-creator checks below.
  }

  if (!isAuthor && !isCreator && !coCreatorWritePermission) {
    return NextResponse.json(
      { error: "You don't have permission to delete this comment." },
      { status: 403 }
    );
  }

  deleteComment(params.id, params.commentId);
  return NextResponse.json({ deleted: true });
}
