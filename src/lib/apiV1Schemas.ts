import { z } from "zod";

const queryInteger = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) return fallback;
      if (typeof value !== "string" || !/^\d+$/.test(value)) return Number.NaN;
      return Number(value);
    },
    z.number().int().min(min).max(max),
  );

export const StellarPublicKeySchema = z.string().regex(/^G[A-Z2-7]{55}$/, "Must be a valid Stellar public key");

export const InvoiceListQuerySchema = z.object({
  publicKey: StellarPublicKeySchema,
  cursor: z.string().regex(/^[1-9]\d*$/).refine((value) => Number.isSafeInteger(Number(value))).optional(),
  limit: queryInteger(20, 1, 50),
  q: z.string().trim().max(100).optional(),
});

export const InvoiceIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Invoice ID must be a positive integer")
  .refine((value) => Number.isSafeInteger(Number(value)), "Invoice ID is out of range");

export const InvoiceHistoryQuerySchema = z.object({
  cursor: queryInteger(0, 0, Number.MAX_SAFE_INTEGER),
  limit: queryInteger(10, 1, 50),
});