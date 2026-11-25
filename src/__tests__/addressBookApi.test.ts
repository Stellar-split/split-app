import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, PUT, DELETE } from "@/app/api/settings/address-book/route";
import { resetServerAddressBook } from "@/lib/serverAddressBook";

vi.mock("@/lib/middleware/csrfMiddleware", () => ({
  assertCsrf: vi.fn().mockResolvedValue(null),
  CSRF_HEADER: "x-csrf-token",
}));

describe("Address Book API (/api/settings/address-book)", () => {
  beforeEach(() => {
    resetServerAddressBook([]);
  });

  it("GET returns empty array initially", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("POST creates a new contact", async () => {
    const req = new NextRequest("http://localhost/api/settings/address-book", {
      method: "POST",
      body: JSON.stringify({
        address: "GAG31234567890123456789012345678901234567890123456789012",
        label: "Charlie Team",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.address).toBe("GAG31234567890123456789012345678901234567890123456789012");
    expect(data.label).toBe("Charlie Team");
  });

  it("POST rejects duplicate address with 409 status code", async () => {
    const address = "GBOB98765432109876543210987654321098765432109876543210987";
    
    // First insert
    await POST(
      new NextRequest("http://localhost/api/settings/address-book", {
        method: "POST",
        body: JSON.stringify({ address, label: "Bob Original" }),
      })
    );

    // Duplicate insert
    const dupReq = new NextRequest("http://localhost/api/settings/address-book", {
      method: "POST",
      body: JSON.stringify({ address, label: "Bob Duplicate" }),
    });

    const res = await POST(dupReq);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("Duplicate address");
  });

  it("GET returns contacts sorted alphabetically by label", async () => {
    await POST(
      new NextRequest("http://localhost/api/settings/address-book", {
        method: "POST",
        body: JSON.stringify({ address: "G...ZACK", label: "Zack" }),
      })
    );

    await POST(
      new NextRequest("http://localhost/api/settings/address-book", {
        method: "POST",
        body: JSON.stringify({ address: "G...ALICE", label: "Alice" }),
      })
    );

    const res = await GET();
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].label).toBe("Alice");
    expect(data[1].label).toBe("Zack");
  });

  it("DELETE removes contact", async () => {
    const postRes = await POST(
      new NextRequest("http://localhost/api/settings/address-book", {
        method: "POST",
        body: JSON.stringify({ address: "G...DEL", label: "Delete Me" }),
      })
    );
    const created = await postRes.json();

    const delReq = new NextRequest(`http://localhost/api/settings/address-book?id=${created.id}`, {
      method: "DELETE",
    });

    const delRes = await DELETE(delReq);
    expect(delRes.status).toBe(200);

    const getRes = await GET();
    const list = await getRes.json();
    expect(list).toHaveLength(0);
  });
});
