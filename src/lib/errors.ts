export type ErrorKind =
  | "wallet_not_connected"
  | "invoice_not_found"
  | "rpc_timeout"
  | "unknown";

export interface ClassifiedError {
  kind: ErrorKind;
  message: string;
}

const PATTERNS: { kind: ErrorKind; match: RegExp; message: string }[] = [
  {
    kind: "wallet_not_connected",
    match: /wallet not connected|connect your freighter|freighter.*not connected/i,
    message: "Connect your Freighter wallet to continue.",
  },
  {
    kind: "invoice_not_found",
    match: /invoice not found|not found on-chain/i,
    message: "This invoice could not be found on-chain.",
  },
  {
    kind: "rpc_timeout",
    match: /rpc timeout|timed out|timeout/i,
    message: "The Stellar RPC request timed out. Please try again.",
  },
];

export function classifyError(error: unknown): ClassifiedError {
  const text = error instanceof Error ? error.message : String(error);

  for (const { kind, match, message } of PATTERNS) {
    if (match.test(text)) {
      return { kind, message };
    }
  }

  return {
    kind: "unknown",
    message: text || "Something went wrong. Please try again.",
  };
}
