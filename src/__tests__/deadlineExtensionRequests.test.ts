import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  submitExtensionRequest,
  getPendingRequest,
  getExtensionRequests,
  approveExtensionRequest,
  denyExtensionRequest,
} from "@/lib/deadlineExtensionRequests";

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
});

const INVOICE_ID = "inv-001";
const REQUESTER = "GCEZWKZPVOPNFHIMZQ3OQNFHM2FQNBXCQ3PNHIMZQ3OQNFHM2FQNBX";
const CREATOR = "GBXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABC";
const FUTURE_DEADLINE = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days from now

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

describe("submitExtensionRequest", () => {
  it("creates a request with status pending", () => {
    const req = submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE, "Need more time");
    expect(req.status).toBe("pending");
    expect(req.invoiceId).toBe(INVOICE_ID);
    expect(req.requester).toBe(REQUESTER);
    expect(req.requestedDeadline).toBe(FUTURE_DEADLINE);
    expect(req.reason).toBe("Need more time");
    expect(req.id).toBeDefined();
    expect(req.createdAt).toBeGreaterThan(0);
  });
});

describe("getPendingRequest", () => {
  it("returns the pending request", () => {
    submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE, "Need more time");
    const pending = getPendingRequest(INVOICE_ID);
    expect(pending).not.toBeNull();
    expect(pending!.status).toBe("pending");
    expect(pending!.invoiceId).toBe(INVOICE_ID);
  });

  it("returns null when no pending request exists", () => {
    expect(getPendingRequest(INVOICE_ID)).toBeNull();
  });
});

describe("single-pending-request constraint", () => {
  it("throws when submitting a second request while one is pending", () => {
    submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE, "First request");
    expect(() =>
      submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE + 3600, "Second request"),
    ).toThrow("An extension request is already pending for this invoice.");
  });
});

describe("approveExtensionRequest", () => {
  it("changes status to approved and sets resolvedAt/resolvedBy", () => {
    const req = submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE, "Please extend");
    const approved = approveExtensionRequest(req.id, CREATOR);
    expect(approved.status).toBe("approved");
    expect(approved.resolvedAt).toBeGreaterThan(0);
    expect(approved.resolvedBy).toBe(CREATOR);
  });
});

describe("denyExtensionRequest", () => {
  it("changes status to denied and sets resolvedAt/resolvedBy", () => {
    const req = submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE, "Please extend");
    const denied = denyExtensionRequest(req.id, CREATOR);
    expect(denied.status).toBe("denied");
    expect(denied.resolvedAt).toBeGreaterThan(0);
    expect(denied.resolvedBy).toBe(CREATOR);
  });
});

describe("after resolving, a new request can be submitted", () => {
  it("allows a new request after approval", () => {
    const req = submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE, "First");
    approveExtensionRequest(req.id, CREATOR);
    expect(getPendingRequest(INVOICE_ID)).toBeNull();

    const req2 = submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE + 7200, "Second");
    expect(req2.status).toBe("pending");
    expect(getExtensionRequests(INVOICE_ID)).toHaveLength(2);
  });

  it("allows a new request after denial", () => {
    const req = submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE, "First");
    denyExtensionRequest(req.id, CREATOR);
    expect(getPendingRequest(INVOICE_ID)).toBeNull();

    const req2 = submitExtensionRequest(INVOICE_ID, REQUESTER, FUTURE_DEADLINE + 7200, "Second");
    expect(req2.status).toBe("pending");
    expect(getExtensionRequests(INVOICE_ID)).toHaveLength(2);
  });
});
