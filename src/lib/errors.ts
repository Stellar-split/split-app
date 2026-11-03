export class AppError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

export function getErrorTemplate(code: string): string {
  return "Error";
}

export function logError(error: any): void {}

export function getErrorCopy(error: any): string {
  return error?.message || "Unknown error";
}
