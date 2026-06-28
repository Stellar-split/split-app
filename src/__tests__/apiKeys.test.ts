/**
 * Unit tests for API key scoped permissions (#219):
 * - Legacy key migration defaults to write scope
 * - Read-only key rejected on write endpoints
 * - Write key allowed on write endpoints
 */

import {
  STORAGE_KEY,
  checkWriteScope,
  generateKeyValue,
  loadKeys,
  parseScopeFromKey,
} from "@/lib/apiKeys";
import { generateSignedApiKey, verifySignedApiKey } from "@/lib/signedApiKeys";
import { POST as testWebhookPost } from "@/app/api/test-webhook/route";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};
Object.defineProperty(global, "localStorage", { value: localStorageMock });

let fetchMock: jest.Mock;

beforeEach(() => {
  localStorageMock.clear();
  fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => "ok",
    headers: { forEach: () => {} },
  });
  global.fetch = fetchMock;
});

describe("parseScopeFromKey", () => {
  it("returns read for sk_read_ keys", () => {
    expect(parseScopeFromKey("sk_read_abc-123")).toBe("read");
  });

  it("returns write for sk_write_ keys", () => {
    expect(parseScopeFromKey("sk_write_abc-123")).toBe("write");
  });

  it("returns write for legacy sk_<uuid> keys", () => {
    expect(parseScopeFromKey("sk_550e8400-e29b-41d4-a716-446655440000")).toBe("write");
  });

  it("returns null for invalid keys", () => {
    expect(parseScopeFromKey("invalid")).toBeNull();
  });
});

describe("checkWriteScope", () => {
  it("rejects read-only keys with 403", () => {
    const result = checkWriteScope(generateSignedApiKey("read").key, verifySignedApiKey);
    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "This endpoint requires write scope. Your API key is read-only.",
    });
  });

  it("allows write-scoped keys", () => {
    const result = checkWriteScope(generateSignedApiKey("write").key, verifySignedApiKey);
    expect(result).toEqual({ ok: true, scope: "write" });
  });

  it("rejects forged write-prefixed keys", () => {
    const result = checkWriteScope("sk_write_anything", verifySignedApiKey);
    expect(result).toEqual({ ok: false, status: 401, error: "Invalid API key." });
  });

  it("returns 401 when token is missing", () => {
    const result = checkWriteScope(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});

describe("loadKeys migration", () => {
  it("defaults legacy keys without scope to write", () => {
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "legacy-1",
          name: "old-service",
          key: "sk_550e8400-e29b-41d4-a716-446655440000",
          createdAt: 1_700_000_000_000,
        },
      ])
    );

    const { keys, migratedLegacy } = loadKeys();
    expect(migratedLegacy).toBe(true);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.scope).toBe("write");
  });

  it("does not flag keys that already have scope", () => {
    localStorageMock.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "new-1",
          name: "readonly",
          key: generateKeyValue("read"),
          scope: "read",
          createdAt: Date.now(),
        },
      ])
    );

    const { keys, migratedLegacy } = loadKeys();
    expect(migratedLegacy).toBe(false);
    expect(keys[0]?.scope).toBe("read");
  });
});

describe("POST /api/test-webhook scope enforcement", () => {
  const url = "https://example.com/hook";

  async function callWebhook(token: string | null) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = new Request("http://localhost/api/test-webhook", {
      method: "POST",
      headers,
      body: JSON.stringify({ url }),
    });

    return testWebhookPost(req as unknown as import("next/server").NextRequest);
  }

  it("rejects read-only keys with 403", async () => {
    const res = await callWebhook(generateSignedApiKey("read").key);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("write scope");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows write-scoped keys", async () => {
    const res = await callWebhook(generateSignedApiKey("write").key);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("rejects forged write keys", async () => {
    const res = await callWebhook("sk_write_anything");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid API key.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
