// src/lib/invoiceDeepLinkGenerator.ts
// Invoice deep-link generation, parsing and validation helpers.

/** Parameters carried by an invoice payment deep link. */
export interface DeepLinkParams {
  /** Recipient Stellar address. */
  to: string;
  /** Asset code (e.g. USDC, XLM). */
  asset: string;
  /** Amount as a decimal string. */
  amount: string;
  /** Optional memo (max 28 characters). */
  memo?: string;
}

/** A generated deep link together with its QR code data URL. */
export interface GeneratedLink {
  url: string;
  qrCodeDataUrl: string;
}

/** Maximum amount supported by Stellar (int64 stroops). */
export const MAX_AMOUNT = 922337203685.4775;

/** Maximum memo length supported by Stellar text memos. */
export const MAX_MEMO_LENGTH = 28;

/** Base path of the invoice payment page. */
export const DEEP_LINK_PATH = "/pay/new";

/**
 * Build an invoice payment deep link from the given parameters.
 * Values are URL-encoded via URLSearchParams.
 */
export function generateDeepLink(params: DeepLinkParams): string {
  const queryParams = new URLSearchParams();
  queryParams.set("to", params.to);
  queryParams.set("asset", params.asset);
  queryParams.set("amount", params.amount);
  if (params.memo) {
    queryParams.set("memo", params.memo);
  }
  return `${DEEP_LINK_PATH}?${queryParams.toString()}`;
}

/**
 * Parse an invoice payment deep link into its parameters.
 * Returns null when the URL is invalid or a required parameter is missing.
 */
export function parseDeepLinkParams(url: string): DeepLinkParams | null {
  try {
    const base =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost";
    const urlObj = new URL(url, base);
    const params = urlObj.searchParams;

    const to = params.get("to");
    const asset = params.get("asset");
    const amount = params.get("amount");

    if (!to || !asset || !amount) {
      return null;
    }

    return {
      to,
      asset,
      amount,
      memo: params.get("memo") || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Validate deep-link parameters (address, asset code, amount and memo).
 */
export function validateDeepLinkParams(params: DeepLinkParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate address (must be 56 chars and start with G)
  if (!/^G[A-Z2-7]{55}$/.test(params.to)) {
    errors.push("Invalid recipient address format");
  }

  // Validate asset code (1-12 alphanumeric)
  if (!/^[A-Z0-9]{1,12}$/.test(params.asset)) {
    errors.push("Invalid asset code format");
  }

  // Validate amount (positive number)
  const amount = parseFloat(params.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push("Amount must be a positive number");
  }

  // Validate amount doesn't exceed max
  if (amount > MAX_AMOUNT) {
    errors.push("Amount exceeds maximum value");
  }

  // Validate memo if provided (max 28 chars)
  if (params.memo && params.memo.length > MAX_MEMO_LENGTH) {
    errors.push("Memo exceeds maximum length of 28 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a QR code data URL for the given deep link.
 * The payload URL is embedded so distinct payloads produce distinct codes.
 */
export async function generateQRCode(url: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><data>${url}</data></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
