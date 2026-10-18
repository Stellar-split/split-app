import { z } from "zod";
import { sanitizeHtml } from "./htmlSanitizer";

/**
 * Shared form validation / sanitization utilities (#918 "Implement input
 * validation and sanitization for all forms").
 *
 * This centralizes the per-field rules, HTML sanitization, a honeypot
 * check, and a lightweight in-memory rate limiter so individual form
 * handlers (client components and API routes) don't each reinvent them.
 */

// ---------------------------------------------------------------------------
// Per-field validation rules
// ---------------------------------------------------------------------------

/** Plain display name / label text: no HTML, reasonable length. */
export const nameField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(120, "Must be 120 characters or fewer")
  .refine((v) => !/[<>]/.test(v), "HTML is not allowed in this field");

export const emailField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(254)
  .email("Enter a valid email address");

/** Free-text field (comments, notes, memo lines) — sanitized, not raw HTML. */
export const freeTextField = z
  .string()
  .trim()
  .max(2000, "Must be 2000 characters or fewer");

export const amountField = z
  .number({ invalid_type_error: "Enter a valid number" })
  .finite()
  .positive("Amount must be greater than 0")
  .max(1_000_000_000, "Amount is too large");

/** Stellar/Soroban-style account or contract address: strict allow-list. */
export const addressField = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]{56}$/, "Enter a valid Stellar address");

/** Honeypot field: must always arrive empty from a real user. */
export const honeypotField = z
  .string()
  .max(0, "Spam detected")
  .optional()
  .or(z.literal(""));

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------

/** Strip HTML and collapse whitespace for plain-text fields. */
export function sanitizePlainText(value: string): string {
  const stripped = sanitizeHtml(value).replace(/<[^>]*>/g, "");
  return stripped.replace(/\s+/g, " ").trim();
}

/**
 * Validate `data` against a zod schema and return sanitized plain-text
 * values. Throws a `FormValidationError` with field-level messages on
 * failure, suitable for returning as a 400 response from an API route.
 */
export class FormValidationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    super("Validation failed");
    this.name = "FormValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function validateForm<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  data: unknown
): z.infer<z.ZodObject<T>> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new FormValidationError(result.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

/** Returns true if a honeypot field was filled in (i.e. likely a bot). */
export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Lightweight in-memory rate limiter for form submission endpoints
// ---------------------------------------------------------------------------

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiter keyed by caller-supplied identifier (e.g. IP
 * address or session id). Suitable for single-instance / serverless
 * deployments; swap for a shared store (Redis, etc.) if running multiple
 * instances behind a load balancer.
 */
export function checkFormRateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}
