/**
 * Throw this for expected, user-facing errors (validation failures,
 * "not found", business-rule violations, etc). Its `message` is safe
 * to return to the client as-is.
 *
 * Any other thrown value (a plain Error, a D1 exception, a TypeError
 * from a bug, ...) is treated as unexpected and its message is NEVER
 * sent to the client — see the onError handler in index.ts.
 */
export class AppError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

// Convenience helpers for the common cases
export const notFound = (what: string) => new AppError(`${what} not found`, 404);
export const badRequest = (message: string) => new AppError(message, 400);
export const conflict = (message: string) => new AppError(message, 409);
export const forbidden = (message: string) => new AppError(message, 403);