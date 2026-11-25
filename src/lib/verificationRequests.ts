/**
 * verificationRequests.ts — Creator verification request flow
 *
 * Manages verification requests submitted by invoice creators.
 * Requests are stored in localStorage and designed to be consumed
 * by an external admin review process.
 */

/**
 * Represents a creator's verification request for admin review.
 *
 * @property id - Unique identifier (UUID v4) for the request.
 * @property address - Stellar wallet address of the requesting creator.
 * @property displayName - Human-readable name the creator wants to be known by.
 * @property links - Social media or website URLs provided as supporting evidence.
 * @property status - Current review state: "pending" awaits admin action,
 *   "approved" or "denied" indicate a resolved decision.
 * @property submittedAt - Unix timestamp in milliseconds when the request was created.
 * @property resolvedAt - Unix timestamp in milliseconds when the request was
 *   approved or denied (undefined while pending).
 *
 * This structure is designed for external/admin processing. An admin dashboard
 * or API can read these records from storage, review the creator's details and
 * links, and update the status to "approved" or "denied" with a resolvedAt
 * timestamp.
 */
export interface VerificationRequest {
  id: string;
  address: string;
  displayName: string;
  links: string[];
  status: "pending" | "approved" | "denied";
  submittedAt: number;
  resolvedAt?: number;
}

const STORAGE_KEY = "stellarsplit_verification_requests";

/**
 * Retrieve all verification requests from storage.
 */
export function getVerificationRequests(): VerificationRequest[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VerificationRequest[];
  } catch {
    return [];
  }
}

/**
 * Get the most recent verification request for a specific wallet address.
 * Returns the latest request by submission time, or null if none exists.
 */
export function getRequestByAddress(address: string): VerificationRequest | null {
  const requests = getVerificationRequests();
  let latest: VerificationRequest | null = null;
  for (const r of requests) {
    if (r.address === address) {
      if (!latest || r.submittedAt >= latest.submittedAt) {
        latest = r;
      }
    }
  }
  return latest;
}

/**
 * Submit a new verification request.
 *
 * @throws Error if displayName is empty
 * @throws Error if any link is not a valid URL
 * @throws Error if a pending request already exists for this address
 */
export function submitVerificationRequest(
  address: string,
  displayName: string,
  links: string[]
): VerificationRequest {
  if (!displayName.trim()) {
    throw new Error("Display name is required.");
  }

  for (const link of links) {
    if (!isValidUrl(link)) {
      throw new Error(`Invalid URL: ${link}`);
    }
  }

  const existing = getRequestByAddress(address);
  if (existing && existing.status === "pending") {
    throw new Error(
      "You already have a pending verification request. Please wait for it to be reviewed."
    );
  }

  const request: VerificationRequest = {
    id: crypto.randomUUID(),
    address,
    displayName: displayName.trim(),
    links,
    status: "pending",
    submittedAt: Date.now(),
  };

  const requests = getVerificationRequests();
  requests.push(request);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));

  return request;
}

/**
 * Validate a URL string (must use http or https protocol).
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
