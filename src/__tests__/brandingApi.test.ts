import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PUT } from "@/app/api/settings/branding/route";
import { POST } from "@/app/api/settings/branding/logo/route";
import { GET as GET_LOGO_ASSET } from "@/app/api/settings/branding/logo/[...key]/route";
import {
  LOGO_SIZE_ERROR,
  LOGO_TYPE_ERROR,
  MAX_LOGO_BYTES,
} from "@/lib/brandSettings";
import { clearBrandSettings } from "@/lib/brandSettingsStore";

const ALICE = "GBRPYHIL2CI3WHZDTOOQFC6EB4WXONTZJ3TXFLQ5XJJIJF4OJZC6J65A";
const BOB = "GBTCHKH4IIT3DYQF7GAZPRMH5CHA4RTJOY2O3YYJWCEPIA3XBKXZMWPA";

const apiUrl = "http://localhost/api/settings/branding";
const logoUrl = `${apiUrl}/logo`;

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Minimal PNG byte stream with a 600x400 IHDR (headers are all we parse). */
function pngBytes(width = 600, height = 400): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  const dv = new DataView(bytes.buffer);
  dv.setUint32(16, width);
  dv.setUint32(20, height);
  return bytes;
}

/**
 * Builds a multipart logo upload request. `request.formData()` is stubbed
 * with a real jsdom FormData so the route exercises genuine File semantics
 * without depending on a network multipart parser.
 */
function logoUploadRequest(formValues: { address?: string; file?: File }): NextRequest {
  const form = new FormData();
  if (formValues.address !== undefined) form.append("address", formValues.address);
  if (formValues.file !== undefined) form.append("file", formValues.file);
  const req = new NextRequest(logoUrl, { method: "POST" });
  vi.spyOn(req, "formData").mockResolvedValue(form);
  return req;
}

describe("Branding settings API (/api/settings/branding)", () => {
  beforeEach(() => {
    clearBrandSettings(ALICE);
    clearBrandSettings(BOB);
  });

  describe("GET", () => {
    it("returns platform defaults for an account with no saved branding", async () => {
      const res = await GET(new NextRequest(`${apiUrl}?address=${ALICE}`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ logoUrl: null, accentColor: null, tagline: null, updatedAt: "" });
    });

    it("rejects a missing address with 400", async () => {
      const res = await GET(new NextRequest(apiUrl));
      expect(res.status).toBe(400);
    });

    it("rejects a malformed address with 400", async () => {
      const res = await GET(new NextRequest(`${apiUrl}?address=not-an-address`));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Stellar address");
    });
  });

  describe("PUT", () => {
    it("saves valid brand settings and echoes them back", async () => {
      const res = await PUT(
        jsonRequest(apiUrl, "PUT", {
          address: ALICE,
          logoUrl: "https://cdn.example.com/logo.png",
          accentColor: "#4f46e5",
          tagline: "Fast, fair splits",
        }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.logoUrl).toBe("https://cdn.example.com/logo.png");
      expect(data.accentColor).toBe("#4f46e5");
      expect(data.tagline).toBe("Fast, fair splits");
      expect(typeof data.updatedAt).toBe("string");

      // …and they persist for subsequent reads (across "reloads").
      const reread = await GET(new NextRequest(`${apiUrl}?address=${ALICE}`));
      expect((await reread.json()).accentColor).toBe("#4f46e5");
    });

    it("scopes settings to the account: other accounts stay on defaults", async () => {
      await PUT(jsonRequest(apiUrl, "PUT", { address: ALICE, accentColor: "#4f46e5" }));
      const res = await GET(new NextRequest(`${apiUrl}?address=${BOB}`));
      expect((await res.json()).accentColor).toBeNull();
    });

    it("rejects a malformed address with 400", async () => {
      const res = await PUT(jsonRequest(apiUrl, "PUT", { address: "nope", accentColor: "#4f46e5" }));
      expect(res.status).toBe(400);
    });

    it("rejects invalid hex colors with 400 and a specific message", async () => {
      const res = await PUT(jsonRequest(apiUrl, "PUT", { address: ALICE, accentColor: "blue" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("valid hex color");
    });

    it("rejects accent colors failing WCAG AA contrast against white", async () => {
      const res = await PUT(
        jsonRequest(apiUrl, "PUT", { address: ALICE, accentColor: "#f2f2f2" }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("WCAG AA");

      // …and nothing was persisted.
      const reread = await GET(new NextRequest(`${apiUrl}?address=${ALICE}`));
      expect((await reread.json()).accentColor).toBeNull();
    });

    it("rejects taglines over 120 characters with 400", async () => {
      const res = await PUT(jsonRequest(apiUrl, "PUT", { address: ALICE, tagline: "x".repeat(121) }));
      expect(res.status).toBe(400);
    });

    it("rejects unparseable bodies with 400", async () => {
      const req = new NextRequest(apiUrl, { method: "PUT", body: "{not json" });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("clears saved branding so invoices revert to platform defaults", async () => {
      await PUT(jsonRequest(apiUrl, "PUT", { address: ALICE, accentColor: "#4f46e5", tagline: "hi" }));

      const res = await DELETE(jsonRequest(apiUrl, "DELETE", { address: ALICE }));
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);

      const reread = await GET(new NextRequest(`${apiUrl}?address=${ALICE}`));
      const data = await reread.json();
      expect(data.accentColor).toBeNull();
      expect(data.tagline).toBeNull();
      expect(data.logoUrl).toBeNull();
    });

    it("is a no-op success when no branding was saved", async () => {
      const res = await DELETE(jsonRequest(apiUrl, "DELETE", { address: ALICE }));
      expect(res.status).toBe(200);
    });

    it("rejects a malformed address with 400", async () => {
      const res = await DELETE(jsonRequest(apiUrl, "DELETE", { address: "junk" }));
      expect(res.status).toBe(400);
    });
  });
});

describe("Branding logo API (/api/settings/branding/logo)", () => {
  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("accepts a PNG under 2 MB and returns a CDN-style URL + detected size", async () => {
    const file = new File([pngBytes(600, 400)], "logo.png", { type: "image/png" });
    const res = await POST(logoUploadRequest({ address: ALICE, file }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.logoUrl).toMatch(/^\/api\/settings\/branding\/logo\/branding\/.+\.png$/);
    expect(data.cdn).toBe(false);
    expect(data.width).toBe(600);
    expect(data.height).toBe(400);
    expect(data.warning).toBeNull();
    expect(data.maxBytes).toBe(MAX_LOGO_BYTES);
    expect(data.allowedTypes).toEqual(["image/png", "image/jpeg", "image/webp"]);
  });

  it("warns when the logo is too small for crisp 300 dpi print", async () => {
    const file = new File([pngBytes(120, 40)], "logo.png", { type: "image/png" });
    const res = await POST(logoUploadRequest({ address: ALICE, file }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.width).toBe(120);
    expect(data.warning).toContain("300 dpi");
  });

  it("accepts JPEG and WebP uploads", async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], "logo.jpg", {
      type: "image/jpeg",
    });
    const res = await POST(logoUploadRequest({ address: ALICE, file: jpeg }));
    expect(res.status).toBe(201);

    const webp = new File([new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4])], "logo.webp", {
      type: "image/webp",
    });
    const res2 = await POST(logoUploadRequest({ address: ALICE, file: webp }));
    expect(res2.status).toBe(201);
  });

  it("rejects files over the 2 MB cap with the specific size error (413)", async () => {
    const oversized = new File([new Uint8Array(MAX_LOGO_BYTES + 1)], "huge.png", {
      type: "image/png",
    });
    const res = await POST(logoUploadRequest({ address: ALICE, file: oversized }));

    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe(LOGO_SIZE_ERROR);
  });

  it.each(["image/gif", "image/svg+xml", "text/plain", "application/pdf"])(
    "rejects MIME type %s with the specific type error (415)",
    async (mime) => {
      const file = new File([new Uint8Array(32)], "logo.bin", { type: mime });
      const res = await POST(logoUploadRequest({ address: ALICE, file }));

      expect(res.status).toBe(415);
      expect((await res.json()).error).toBe(LOGO_TYPE_ERROR);
    },
  );

  it("rejects uploads without a file", async () => {
    const res = await POST(logoUploadRequest({ address: ALICE }));
    expect(res.status).toBe(400);
  });

  it("rejects uploads from a malformed address with 401", async () => {
    const file = new File([pngBytes()], "logo.png", { type: "image/png" });
    const res = await POST(logoUploadRequest({ address: "not-an-address", file }));
    expect(res.status).toBe(401);
  });

  it("serves a stored logo with immutable CDN-style cache headers", async () => {
    const bytes = pngBytes(800, 200);
    const file = new File([bytes], "logo.png", { type: "image/png" });
    const upload = await POST(logoUploadRequest({ address: ALICE, file }));
    const { key } = await upload.json();

    const res = await GET_LOGO_ASSET(new NextRequest(`http://localhost/api/settings/branding/logo/${key}`), {
      params: { key: key.split("/") },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    const served = new Uint8Array(await res.arrayBuffer());
    expect(served.length).toBe(bytes.length);
    expect(Array.from(served.slice(0, 8))).toEqual(Array.from(bytes.slice(0, 8)));
  });

  it("returns 404 for unknown keys and 400 for malformed keys", async () => {
    const missing = await GET_LOGO_ASSET(new NextRequest("http://localhost/x"), {
      params: { key: ["branding", ALICE, "logo-999.png"] },
    });
    expect(missing.status).toBe(404);

    const malformed = await GET_LOGO_ASSET(new NextRequest("http://localhost/x"), {
      params: { key: ["..", "..", "etc"] },
    });
    expect(malformed.status).toBe(400);
  });
});
