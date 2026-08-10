import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/invoices/[id]/comments/route";
import { POST as reactPOST } from "@/app/api/invoices/[id]/comments/[commentId]/reactions/route";
import { DELETE as deleteRoute } from "@/app/api/invoices/[id]/comments/[commentId]/route";
import { __resetCommentStoreForTests } from "@/lib/commentStore";

vi.mock("@/lib/middleware/csrfMiddleware", () => ({
  assertCsrf: vi.fn().mockResolvedValue(null),
  CSRF_HEADER: "x-csrf-token",
}));

vi.mock("@/lib/stellar", () => ({
  getSplitClient: () => ({
    getInvoice: vi.fn().mockResolvedValue({ creator: "GCREATOR" }),
  }),
}));

function postRequest(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function deleteRequest(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("invoice comments API", () => {
  beforeEach(() => {
    __resetCommentStoreForTests();
  });

  it("rejects posting a comment without an author address", async () => {
    const res = await POST(postRequest("/api/invoices/inv-1/comments", { text: "hi" }), {
      params: { id: "inv-1" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an empty comment", async () => {
    const res = await POST(
      postRequest("/api/invoices/inv-1/comments", { authorAddress: "GALICE", text: "   " }),
      { params: { id: "inv-1" } }
    );
    expect(res.status).toBe(400);
  });

  it("creates a comment and lists it with reaction data", async () => {
    const createRes = await POST(
      postRequest("/api/invoices/inv-1/comments", { authorAddress: "GALICE", text: "**hi**" }),
      { params: { id: "inv-1" } }
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const listRes = await GET(new NextRequest("http://localhost/api/invoices/inv-1/comments"), {
      params: { id: "inv-1" },
    });
    const { comments } = await listRes.json();
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(created.id);
    expect(comments[0].reactions).toEqual({ "👍": 0, "❤️": 0, "✅": 0, "❓": 0 });
  });

  it("toggles a reaction via the reactions route", async () => {
    const createRes = await POST(
      postRequest("/api/invoices/inv-1/comments", { authorAddress: "GALICE", text: "hi" }),
      { params: { id: "inv-1" } }
    );
    const created = await createRes.json();

    const reactRes = await reactPOST(
      postRequest(`/api/invoices/inv-1/comments/${created.id}/reactions`, {
        emoji: "👍",
        reactorId: "GBOB",
      }),
      { params: { id: "inv-1", commentId: created.id } }
    );
    expect(reactRes.status).toBe(200);
    const reactData = await reactRes.json();
    expect(reactData.active).toBe(true);
    expect(reactData.counts["👍"]).toBe(1);
  });

  it("rejects reactions using a disallowed emoji", async () => {
    const createRes = await POST(
      postRequest("/api/invoices/inv-1/comments", { authorAddress: "GALICE", text: "hi" }),
      { params: { id: "inv-1" } }
    );
    const created = await createRes.json();

    const res = await reactPOST(
      postRequest(`/api/invoices/inv-1/comments/${created.id}/reactions`, {
        emoji: "🎉",
        reactorId: "GBOB",
      }),
      { params: { id: "inv-1", commentId: created.id } }
    );
    expect(res.status).toBe(400);
  });

  it("lets the comment author delete their own comment", async () => {
    const createRes = await POST(
      postRequest("/api/invoices/inv-1/comments", { authorAddress: "GALICE", text: "hi" }),
      { params: { id: "inv-1" } }
    );
    const created = await createRes.json();

    const res = await deleteRoute(
      deleteRequest(`/api/invoices/inv-1/comments/${created.id}`, { requesterAddress: "GALICE" }),
      { params: { id: "inv-1", commentId: created.id } }
    );
    expect(res.status).toBe(200);
  });

  it("blocks a non-author, non-creator, non-co-creator from deleting", async () => {
    const createRes = await POST(
      postRequest("/api/invoices/inv-1/comments", { authorAddress: "GALICE", text: "hi" }),
      { params: { id: "inv-1" } }
    );
    const created = await createRes.json();

    const res = await deleteRoute(
      deleteRequest(`/api/invoices/inv-1/comments/${created.id}`, { requesterAddress: "GMALLORY" }),
      { params: { id: "inv-1", commentId: created.id } }
    );
    expect(res.status).toBe(403);
  });

  it("lets the invoice creator delete any comment", async () => {
    const createRes = await POST(
      postRequest("/api/invoices/inv-1/comments", { authorAddress: "GALICE", text: "hi" }),
      { params: { id: "inv-1" } }
    );
    const created = await createRes.json();

    const res = await deleteRoute(
      deleteRequest(`/api/invoices/inv-1/comments/${created.id}`, { requesterAddress: "GCREATOR" }),
      { params: { id: "inv-1", commentId: created.id } }
    );
    expect(res.status).toBe(200);
  });

  it("lets a co-creator with write permission delete any comment", async () => {
    const createRes = await POST(
      postRequest("/api/invoices/inv-1/comments", { authorAddress: "GALICE", text: "hi" }),
      { params: { id: "inv-1" } }
    );
    const created = await createRes.json();

    const res = await deleteRoute(
      deleteRequest(`/api/invoices/inv-1/comments/${created.id}`, {
        requesterAddress: "GCOCREATOR",
        coCreatorWritePermission: true,
      }),
      { params: { id: "inv-1", commentId: created.id } }
    );
    expect(res.status).toBe(200);
  });
});
