import { NextRequest } from "next/server";
import { POST } from "@/app/api/invoices/drafts/route";

vi.mock("@/lib/middleware/csrfMiddleware", () => ({
  assertCsrf: vi.fn().mockResolvedValue(null),
  CSRF_HEADER: "x-csrf-token",
}));

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/invoices/drafts", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/invoices/drafts", () => {
  it("acknowledges a valid draft upload", async () => {
    const res = await POST(
      postRequest({ draftId: "draft-a", userId: "user-1", data: { token: "USDC" } })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, draftId: "draft-a" });
  });

  it("rejects a missing draftId", async () => {
    const res = await POST(postRequest({ userId: "user-1", data: {} }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing userId", async () => {
    const res = await POST(postRequest({ draftId: "draft-a", data: {} }));
    expect(res.status).toBe(400);
  });

  it("rejects missing data", async () => {
    const res = await POST(postRequest({ draftId: "draft-a", userId: "user-1" }));
    expect(res.status).toBe(400);
  });
});
