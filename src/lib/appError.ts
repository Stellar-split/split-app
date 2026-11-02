export class AppError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
