import { NextRequest, NextResponse } from "next/server";
import { FolderNameSchema, deleteFolder, getFolder, renameFolder } from "@/lib/folders";

/** PATCH /api/folders/:id — rename a folder. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!getFolder(params.id)) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const rawBody = await request.json();
    const parsed = FolderNameSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid folder payload — expected { name: string }",
          details: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const folder = renameFolder(params.id, parsed.data.name);
    return NextResponse.json({ folder }, { status: 200 });
  } catch (error) {
    console.error("Folder rename error:", error);
    return NextResponse.json(
      {
        error: "Failed to rename folder",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/** DELETE /api/folders/:id — delete a folder and clear its membership. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const removed = deleteFolder(params.id);
    if (!removed) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Folder delete error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete folder",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
