import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isValidUrl,
  submitVerificationRequest,
  getRequestByAddress,
  getVerificationRequests,
} from "@/lib/verificationRequests";

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
});

const ADDRESS = "GCEZWKZPVOPNFHIMZQ3OQNFHM2FQNBXCQ3PNHIMZQ3OQNFHM2FQNBX";

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

describe("isValidUrl", () => {
  it("accepts valid http URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("accepts valid https URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("https://twitter.com/user")).toBe(true);
    expect(isValidUrl("https://github.com/user/repo")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidUrl("")).toBe(false);
  });

  it("rejects URLs without protocol", () => {
    expect(isValidUrl("example.com")).toBe(false);
  });

  it("rejects ftp protocol", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });

  it("rejects javascript protocol", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });
});

describe("submitVerificationRequest", () => {
  it("creates a request with status pending", () => {
    const request = submitVerificationRequest(ADDRESS, "Alice", ["https://twitter.com/alice"]);
    expect(request.status).toBe("pending");
    expect(request.address).toBe(ADDRESS);
    expect(request.displayName).toBe("Alice");
    expect(request.links).toEqual(["https://twitter.com/alice"]);
    expect(request.id).toBeTruthy();
    expect(request.submittedAt).toBeGreaterThan(0);
    expect(request.resolvedAt).toBeUndefined();
  });

  it("throws when displayName is empty", () => {
    expect(() => submitVerificationRequest(ADDRESS, "", [])).toThrow(
      "Display name is required."
    );
  });

  it("throws when displayName is only whitespace", () => {
    expect(() => submitVerificationRequest(ADDRESS, "   ", [])).toThrow(
      "Display name is required."
    );
  });

  it("throws when a link is invalid", () => {
    expect(() =>
      submitVerificationRequest(ADDRESS, "Alice", ["not-a-url"])
    ).toThrow("Invalid URL: not-a-url");
  });

  it("stores the request in localStorage", () => {
    submitVerificationRequest(ADDRESS, "Bob", []);
    const requests = getVerificationRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0].displayName).toBe("Bob");
  });

  it("accepts an empty links array", () => {
    const request = submitVerificationRequest(ADDRESS, "Carol", []);
    expect(request.links).toEqual([]);
  });
});

describe("duplicate-submission blocking", () => {
  it("throws when a pending request already exists for the address", () => {
    submitVerificationRequest(ADDRESS, "Alice", []);
    expect(() => submitVerificationRequest(ADDRESS, "Alice Again", [])).toThrow(
      "You already have a pending verification request"
    );
  });

  it("allows a new submission after a previous request is resolved", () => {
    submitVerificationRequest(ADDRESS, "Alice", []);

    // Simulate admin resolving the request
    const requests = getVerificationRequests();
    requests[0].status = "approved";
    requests[0].resolvedAt = Date.now();
    localStorage.setItem(
      "stellarsplit_verification_requests",
      JSON.stringify(requests)
    );

    // Should not throw — previous request is no longer pending
    const newRequest = submitVerificationRequest(ADDRESS, "Alice v2", []);
    expect(newRequest.status).toBe("pending");
    expect(newRequest.displayName).toBe("Alice v2");
  });
});

describe("getRequestByAddress", () => {
  it("returns null for unknown addresses", () => {
    expect(getRequestByAddress("UNKNOWN_ADDRESS")).toBeNull();
  });

  it("returns the request for a known address", () => {
    const submitted = submitVerificationRequest(ADDRESS, "Dave", []);
    const found = getRequestByAddress(ADDRESS);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(submitted.id);
  });

  it("returns the most recent request when multiple exist", () => {
    submitVerificationRequest(ADDRESS, "First", []);

    // Resolve the first request so we can submit another
    const requests = getVerificationRequests();
    requests[0].status = "denied";
    requests[0].resolvedAt = Date.now();
    localStorage.setItem(
      "stellarsplit_verification_requests",
      JSON.stringify(requests)
    );

    const second = submitVerificationRequest(ADDRESS, "Second", []);
    const found = getRequestByAddress(ADDRESS);
    expect(found!.id).toBe(second.id);
    expect(found!.displayName).toBe("Second");
  });
});
