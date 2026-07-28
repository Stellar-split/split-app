"use client";

import { useMemo } from "react";
import type { Invoice } from "@stellar-split/sdk";

export type InvoiceRole = "creator" | "recipient" | "viewer";

export function getInvoiceRole(invoice: Invoice | null, publicKey: string | null): InvoiceRole {
  if (!invoice || !publicKey) return "viewer";
  if (invoice.creator === publicKey) return "creator";
  if (invoice.recipients.some((recipient) => recipient.address === publicKey)) return "recipient";
  return "viewer";
}

export function useInvoiceRole(invoice: Invoice | null, publicKey: string | null): InvoiceRole {
  return useMemo(() => getInvoiceRole(invoice, publicKey), [invoice, publicKey]);
}
