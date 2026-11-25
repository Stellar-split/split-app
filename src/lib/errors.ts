export type ErrorKind = "unknown" | "rpc_error" | "validation" | "network" | "timeout" | "contract" | "wallet_not_connected" | "invoice_not_found" | "rpc_timeout";

export interface ClassifiedError {
  kind: "contract" | "network" | "unknown";
  message: string;
}

export class AppError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

export function getErrorTemplate(code: string): any {
  return {
    title: "Error",
    message: "An error occurred",
    suggestions: []
  };
}

export function logError(error: any, context?: any): void {}

export function getErrorCopy(error: any): string {
  return error?.message || "Unknown error";
}

export function classifyError(error: any): ErrorKind {
  const msg = String(error?.message || "").toLowerCase();
  if (msg.includes("network") || msg.includes("connection")) return "network";
  if (msg.includes("timeout")) return "timeout";
  if (msg.includes("validation")) return "validation";
  return "unknown";
}

export function classifyRpcError(error: any): ClassifiedError {
  const msg = String(error?.message || "").toLowerCase();
  const isNetwork = msg.includes("network") || msg.includes("connection") || msg.includes("econnrefused");
  const isContract = msg.includes("contract") || msg.includes("transaction");

  return {
    kind: isContract ? "contract" : isNetwork ? "network" : "unknown",
    message: error?.message || "An unexpected error occurred. Please check your connection and try again.",
  };
}
