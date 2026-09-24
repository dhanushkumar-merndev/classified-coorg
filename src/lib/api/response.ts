import { AppError, statusForCode } from "@/lib/errors";
import { logger } from "@/lib/logger";

// Response envelope (architecture §23): {data, error: null, meta} on success,
// {data: null, error: {code, message, detail?}} on failure.

export type ActionResult<T> =
  | { data: T; error: null; meta?: Record<string, unknown> }
  | { data: null; error: { code: string; message: string; detail?: string; retryAfterSeconds?: number } };

export function ok<T>(data: T, meta?: Record<string, unknown>): ActionResult<T> {
  return meta ? { data, error: null, meta } : { data, error: null };
}

export function toFailure(error: unknown, operation: string): ActionResult<never> {
  const appError = error instanceof AppError ? error : new AppError("INTERNAL", { cause: error });
  if (appError.status >= 500) {
    logger.error(operation, { code: appError.code, cause: appError.cause ?? error });
  }
  return {
    data: null,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.detail ? { detail: appError.detail } : {}),
      ...(appError.retryAfterSeconds ? { retryAfterSeconds: appError.retryAfterSeconds } : {}),
    },
  };
}

/** Runs a server action body and converts thrown errors into the envelope,
 *  so actions return typed domain results instead of throwing (test.md §5). */
export async function runAction<T>(operation: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    return toFailure(error, operation);
  }
}

export function jsonResponse<T>(result: ActionResult<T>, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  let status = init.status ?? 200;
  if (result.error) {
    status = statusForCode(result.error.code);
    if (result.error.retryAfterSeconds) headers.set("Retry-After", String(result.error.retryAfterSeconds));
  }
  return Response.json(result, { ...init, status, headers });
}
