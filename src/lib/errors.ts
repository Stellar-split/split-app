export type ErrorKind = "unknown" | "rpc_error" | "validation" | "network" | "timeout";

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

export function classifyError(error: any): string {
  return "unknown";
}

export function classifyRpcError(error: any): string {
  return "rpc_error";
}
