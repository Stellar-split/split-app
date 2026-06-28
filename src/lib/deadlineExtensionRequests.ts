export interface DeadlineExtensionRequest {
  id: string;
  invoiceId: string;
  requester: string; // wallet address of the requester
  requestedDeadline: number; // unix timestamp in seconds
  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: number; // unix timestamp ms
  resolvedAt?: number; // unix timestamp ms
  resolvedBy?: string; // wallet address of the resolver
}

const STORAGE_KEY = "stellarsplit_deadline_extension_requests";

function loadAll(): DeadlineExtensionRequest[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DeadlineExtensionRequest[];
  } catch {
    return [];
  }
}

function saveAll(requests: DeadlineExtensionRequest[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

/** Get all requests for an invoice */
export function getExtensionRequests(invoiceId: string): DeadlineExtensionRequest[] {
  return loadAll().filter((r) => r.invoiceId === invoiceId);
}

/** Get the pending request for an invoice (only one allowed at a time) */
export function getPendingRequest(invoiceId: string): DeadlineExtensionRequest | null {
  return loadAll().find((r) => r.invoiceId === invoiceId && r.status === "pending") ?? null;
}

/** Submit a new request — throws if one is already pending */
export function submitExtensionRequest(
  invoiceId: string,
  requester: string,
  requestedDeadline: number,
  reason: string,
): DeadlineExtensionRequest {
  const all = loadAll();
  const hasPending = all.some((r) => r.invoiceId === invoiceId && r.status === "pending");
  if (hasPending) {
    throw new Error("An extension request is already pending for this invoice.");
  }
  const request: DeadlineExtensionRequest = {
    id: crypto.randomUUID(),
    invoiceId,
    requester,
    requestedDeadline,
    reason,
    status: "pending",
    createdAt: Date.now(),
  };
  all.push(request);
  saveAll(all);
  return request;
}

/** Approve a pending request */
export function approveExtensionRequest(
  requestId: string,
  resolvedBy: string,
): DeadlineExtensionRequest {
  const all = loadAll();
  const request = all.find((r) => r.id === requestId);
  if (!request) throw new Error("Extension request not found.");
  if (request.status !== "pending") throw new Error("Extension request is not pending.");
  request.status = "approved";
  request.resolvedAt = Date.now();
  request.resolvedBy = resolvedBy;
  saveAll(all);
  return request;
}

/** Deny a pending request */
export function denyExtensionRequest(
  requestId: string,
  resolvedBy: string,
): DeadlineExtensionRequest {
  const all = loadAll();
  const request = all.find((r) => r.id === requestId);
  if (!request) throw new Error("Extension request not found.");
  if (request.status !== "pending") throw new Error("Extension request is not pending.");
  request.status = "denied";
  request.resolvedAt = Date.now();
  request.resolvedBy = resolvedBy;
  saveAll(all);
  return request;
}
