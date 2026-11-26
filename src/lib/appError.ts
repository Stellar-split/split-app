export interface AppErrorOptions {
  isNetworkError?: boolean;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;
}

/** Open string taxonomy of error codes (e.g. "RATE_LIMITED", "STELLAR_BAD_SEQUENCE"). */
export type AppErrorCode = string;

/** A suggested recovery step for an AppError, surfaced to the user. */
export interface RecoverySuggestion {
  label: string;
  description: string;
  actionType: string;
}

export class AppError extends Error {
  isNetworkError: boolean = false;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;
  title?: string;
  retryable?: boolean;
  recovery?: RecoverySuggestion[];
  context?: Record<string, unknown>;

  constructor(
    public code: string,
    message: string,
    options: AppErrorOptions | boolean = false
  ) {
    super(message);
    if (typeof options === "boolean") {
      this.isNetworkError = options;
    } else {
      this.isNetworkError = options.isNetworkError ?? false;
      this.status = options.status;
      this.retryAfterMs = options.retryAfterMs;
      this.cause = options.cause;
    }
  }
}

export interface CreateAppErrorParams {
  code: AppErrorCode;
  title?: string;
  message: string;
  retryable?: boolean;
  recovery?: RecoverySuggestion[];
  cause?: unknown;
  context?: Record<string, unknown>;
}

/** Builds an AppError carrying the richer taxonomy fields (title, retryable, recovery, context). */
export function createAppError(params: CreateAppErrorParams): AppError {
  const err = new AppError(params.code, params.message, { cause: params.cause });
  err.title = params.title;
  err.retryable = params.retryable ?? false;
  err.recovery = params.recovery ?? [];
  err.context = params.context;
  return err;
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    const isNetworkError =
      /network|offline|fetch|timeout|connection/i.test(error.message);
    return new AppError("UNKNOWN_ERROR", error.message, isNetworkError);
  }
  return new AppError("UNKNOWN_ERROR", String(error), false);
}
