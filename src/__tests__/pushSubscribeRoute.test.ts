import { NextRequest } from "next/server";
import { POST, DELETE } from "@/app/api/push/subscribe/route";
import { getSubscriptions, __resetPushSubscriptionStoreForTests } from "@/lib/pushSubscriptionStore";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validSubscription = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    __resetPushSubscriptionStoreForTests();
  });

  it("stores a valid subscription against an invoice", async () => {
    const res = await POST(jsonRequest({ invoiceId: "inv-1", subscription: validSubscription }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscribed: true });
    expect(getSubscriptions("inv-1")).toEqual([validSubscription]);
  });

  it("rejects a missing invoiceId", async () => {
    const res = await POST(jsonRequest({ subscription: validSubscription }));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed subscription payload", async () => {
    const res = await POST(jsonRequest({ invoiceId: "inv-1", subscription: { endpoint: "x" } }));
    expect(res.status).toBe(400);
  });

  it("removes a subscription via DELETE", async () => {
    await POST(jsonRequest({ invoiceId: "inv-1", subscription: validSubscription }));
    const res = await DELETE(jsonRequest({ invoiceId: "inv-1", endpoint: validSubscription.endpoint }));
    expect(res.status).toBe(200);
    expect(getSubscriptions("inv-1")).toEqual([]);
  });
});
