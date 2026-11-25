import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { apiSuccess, isApiResponse, prepareApiRequest } from "./apiV1";
import {
  InvoiceHistoryQuerySchema,
  InvoiceIdSchema,
  InvoiceListQuerySchema,
} from "./apiV1Schemas";

describe("v1 API helpers", () => {
  it("serializes bigint values as decimal strings with version metadata", async () => {
    const response = apiSuccess(
      { funded: 12345678901234567890n },
      { requestId: "request-1", remaining: 12, resetAt: 1_800_000_000_000 },
    );

    expect(await response.json()).toEqual({
      data: { funded: "12345678901234567890" },
      meta: { apiVersion: "v1", requestId: "request-1" },
    });
    expect(response.headers.get("X-API-Version")).toBe("v1");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("12");
  });

  it("rejects unauthenticated calls using a consistent error response", async () => {
    const result = prepareApiRequest(new NextRequest("https://example.test/api/v1/invoices"));

    expect(isApiResponse(result)).toBe(true);
    if (isApiResponse(result)) {
      expect(result.status).toBe(401);
      expect((await result.json()).error.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("v1 request schemas", () => {
  it("validates and defaults invoice-list parameters", () => {
    expect(
      InvoiceListQuerySchema.safeParse({
        publicKey: `G${"A".repeat(55)}`,
      }),
    ).toMatchObject({ success: true, data: { limit: 20 } });
    expect(
      InvoiceListQuerySchema.safeParse({ publicKey: "not-a-stellar-key", limit: "51" })
        .success,
    ).toBe(false);
  });

  it("validates invoice IDs and bounded history pagination", () => {
    expect(InvoiceIdSchema.safeParse("42").success).toBe(true);
    expect(InvoiceIdSchema.safeParse("0").success).toBe(false);
    expect(InvoiceHistoryQuerySchema.parse({ cursor: "3", limit: "25" })).toEqual({
      cursor: 3,
      limit: 25,
    });
    expect(InvoiceHistoryQuerySchema.safeParse({ cursor: "-1" }).success).toBe(false);
    expect(InvoiceHistoryQuerySchema.safeParse({ cursor: "" }).success).toBe(false);
    expect(InvoiceIdSchema.safeParse("9007199254740992").success).toBe(false);
  });
});