export interface AppErrorOptions {
  isNetworkError?: boolean;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;
}

export class AppError extends Error {
  isNetworkError: boolean = false;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;

  constructor(
    public code: string,
    message: string,
    options: AppErrorOptions | boolean = false
  ) {
    super(message);
    if (typeof options === 'boolean') {
      this.isNetworkError = options;
    } else {
      this.isNetworkError = options.isNetworkError ?? false;
      this.status = options.status;
      this.retryAfterMs = options.retryAfterMs;
      this.cause = options.cause;
    }
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    const isNetworkError = /network|offline|fetch|timeout|connection/i.test(error.message);
    return new AppError('UNKNOWN_ERROR', error.message, isNetworkError);
  }
  return new AppError('UNKNOWN_ERROR', String(error), false);
}
