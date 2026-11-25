import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  FolderNameSchema,
  MAX_FOLDERS,
  createFolder,
  getMembershipMap,
  listFolders,
} from "@/lib/folders";

/**
 * GET /api/folders — every folder, plus the invoiceId → folderIds membership map.
 *
 * One request serves both the sidebar (the folder list) and list filtering
 * (the membership map), so the folders page doesn't fan out a request per invoice.
 */
export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json(
      { folders: listFolders(), byInvoice: getMembershipMap() },
      { status: 200 }
    );
  } catch (error) {
    console.error("Folder list error:", error);
    return NextResponse.json(
      {
        error: "Failed to list folders",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/** POST /api/folders — create a new named folder. */
export async function POST(request: NextRequest) {
  try {
    if (listFolders().length >= MAX_FOLDERS) {
      return NextResponse.json({ error: `Cannot exceed ${MAX_FOLDERS} folders` }, { status: 422 });
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

    const folder = createFolder(parsed.data.name);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("Folder create error:", error);
    return NextResponse.json(
      {
        error: "Failed to create folder",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
