import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getTags, setTags, normalizeTags } from "@/lib/invoiceTags";
import { assertCsrf } from "@/lib/middleware/csrfMiddleware";


/**
 * PATCH /api/invoices/bulk
 *
 * Bulk operation endpoint for archive, delete, and tag operations.
 * Accepts up to 200 invoice IDs per request.
 *
 * Request body variants:
 *
 *   addTags style (Issue #518 — additive tag assignment):
 *   { ids: string[], addTags: string[] }
 *
 *   Legacy action-style (archive / delete / replace tags):
 *   { invoiceIds: string[], action: 'archive' | 'delete' | 'tag', archived?: boolean, tags?: string[] }
 */
export async function PATCH(request: NextRequest) {
  const csrfError = await assertCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();

    // ── addTags contract (Issue #518) ──────────────────────────────────────
    if (Array.isArray(body.ids) && Array.isArray(body.addTags)) {
      const { ids, addTags } = body as { ids: string[]; addTags: string[] };

      if (ids.length === 0) {
        return NextResponse.json(
          { error: "ids must be a non-empty array" },
          { status: 400 }
        );
      }

      if (ids.length > 200) {
        return NextResponse.json(
          { error: "Maximum 200 invoices per request" },
          { status: 400 }
        );
      }

      const normalizedNew = normalizeTags(addTags);

      if (normalizedNew.length === 0) {
        return NextResponse.json(
          { error: "addTags must contain at least one valid tag" },
          { status: 400 }
        );
      }

      // Merge tags: preserve each invoice's existing tags, append new ones.
      const updated: Record<string, string[]> = {};
      for (const id of ids) {
        const existing = getTags(id);
        const merged = normalizeTags([...existing, ...normalizedNew]);
        setTags(id, merged);
        updated[id] = merged;
      }

      return NextResponse.json(
        {
          success: true,
          count: ids.length,
          addedTags: normalizedNew,
          updated,
        },
        { status: 200 }
      );
    }

    // ── Legacy action-based contract ────────────────────────────────────────
    const { invoiceIds, action, archived, tags } = body as {
      invoiceIds: string[];
      action: string;
      archived?: boolean;
      tags?: string[];
    };

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "invoiceIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (invoiceIds.length > 200) {
      return NextResponse.json(
        { error: "Maximum 200 invoices per request" },
        { status: 400 }
      );
    }

    if (!["archive", "delete", "tag"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'archive', 'delete', or 'tag'" },
        { status: 400 }
      );
    }

    if (action === "archive" && typeof archived !== "boolean") {
      return NextResponse.json(
        { error: "archived must be a boolean for archive action" },
        { status: 400 }
      );
    }

    if (action === "tag" && !Array.isArray(tags)) {
      return NextResponse.json(
        { error: "tags must be an array for tag action" },
        { status: 400 }
      );
    }

    // Apply legacy tag action (replace all tags on each invoice).
    if (action === "tag" && tags) {
      const normalized = normalizeTags(tags);
      for (const id of invoiceIds) {
        setTags(id, normalized);
      }
    }

    // TODO: Implement actual database operations for archive / delete.

    let message = "";
    switch (action) {
      case "archive":
        message = `${invoiceIds.length} invoices ${archived ? "archived" : "unarchived"}`;
        break;
      case "delete":
        message = `${invoiceIds.length} invoices deleted`;
        break;
      case "tag":
        message = `${invoiceIds.length} invoices tagged with: ${tags?.join(", ")}`;
        break;
    }

    return NextResponse.json(
      {
        success: true,
        count: invoiceIds.length,
        action,
        message,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Bulk invoice operation error:", error);
    return NextResponse.json(
      { error: "Failed to process bulk operation" },
      { status: 500 }
    );
  }
}
