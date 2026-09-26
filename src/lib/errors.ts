// Application error codes (architecture §26) and their HTTP mapping
// (test.md §5). Database functions raise the same codes as the error message
// (app.fail), so a code means the same thing in SQL, services and responses.

const STATUS_BY_CODE = {
  VALIDATION_FAILED: 422,
  REASON_REQUIRED: 422,
  LISTING_INCOMPLETE: 422,
  PROFILE_INCOMPLETE: 422,
  INVALID_PHONE: 422,
  INVALID_OTP: 422,
  AUTH_REQUIRED: 401,
  OTP_INVALID_OR_EXPIRED: 401,
  FORBIDDEN: 403,
  ACCOUNT_SUSPENDED: 403,
  PHONE_NOT_VERIFIED: 403,
  SELF_REVIEW_FORBIDDEN: 403,
  SELF_ROLE_CHANGE_FORBIDDEN: 403,
  SELF_ACTION_FORBIDDEN: 403,
  SELF_ENQUIRY_FORBIDDEN: 403,
  PROFILE_MISSING: 403,
  PROPERTY_NOT_FOUND: 404,
  PROPERTY_NOT_AVAILABLE: 404,
  MEDIA_NOT_FOUND: 404,
  DOCUMENT_NOT_FOUND: 404,
  ENQUIRY_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  UPLOAD_NOT_FOUND: 404,
  NOT_FOUND: 404,
  PROPERTY_NOT_EDITABLE: 409,
  INVALID_STATUS_TRANSITION: 409,
  VERSION_CONFLICT: 409,
  REVISION_MISMATCH: 409,
  UPLOAD_IN_PROGRESS: 409,
  UPLOAD_LEASE_LOST: 409,
  UPLOAD_FAILED: 409,
  UPLOAD_EXPIRED: 410,
  LAST_SUPER_ADMIN: 409,
  IMMUTABLE_RECORD: 409,
  IMMUTABLE_FIELD: 409,
  LOCATION_HIERARCHY_CYCLE: 409,
  DUPLICATE_ENQUIRY: 409,
  UPLOAD_LIMIT_REACHED: 409,
  LIMIT_REACHED: 409,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UPLOAD_REJECTED: 422,
  RATE_LIMITED: 429,
  OTP_RATE_LIMITED: 429,
  SMS_DELIVERY_FAILED: 502,
  DEPENDENCY_FAILED: 503,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof STATUS_BY_CODE;

const SAFE_MESSAGES: Partial<Record<ErrorCode, string>> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  FORBIDDEN: "You do not have permission to do that.",
  ACCOUNT_SUSPENDED: "This account is suspended. Please contact support.",
  PROPERTY_NOT_FOUND: "Property not found.",
  PROPERTY_NOT_AVAILABLE: "This property is no longer available.",
  PROPERTY_NOT_EDITABLE: "This listing cannot be edited in its current state.",
  VERSION_CONFLICT: "This listing changed since you opened it. Reload to see the latest version.",
  INVALID_STATUS_TRANSITION: "That action is not allowed for this listing right now.",
  LISTING_INCOMPLETE: "Some required details are missing.",
  RATE_LIMITED: "Too many attempts. Please try again later.",
  OTP_RATE_LIMITED: "Too many code requests. Please wait before trying again.",
  OTP_INVALID_OR_EXPIRED: "That code is incorrect or has expired.",
  INVALID_PHONE: "Enter a valid Indian mobile number.",
  UPLOAD_LIMIT_REACHED: "You have reached the maximum number of files for this listing.",
  FILE_TOO_LARGE: "This file is too large.",
  UNSUPPORTED_MEDIA_TYPE: "This file type is not supported.",
  UPLOAD_REJECTED: "This file could not be accepted.",
  SMS_DELIVERY_FAILED: "We could not send the code. Please try again shortly.",
  DEPENDENCY_FAILED: "Something on our side is not responding. Please try again in a minute.",
  VALIDATION_FAILED: "Please check the highlighted fields.",
  INTERNAL: "Something went wrong. Please try again.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Safe, user-presentable detail (e.g. missing field names). Never secrets. */
  readonly detail?: string;
  readonly retryAfterSeconds?: number;

  constructor(code: ErrorCode, options: { detail?: string; retryAfterSeconds?: number; cause?: unknown } = {}) {
    super(SAFE_MESSAGES[code] ?? code, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.detail = options.detail || undefined;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(STATUS_BY_CODE, value);
}

export function statusForCode(code: string): number {
  return isErrorCode(code) ? STATUS_BY_CODE[code] : 500;
}

interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  code?: string;
}

/** Converts a Supabase/PostgREST error into an AppError. Only allowlisted
 *  application codes raised by app.fail() pass through; anything else
 *  (SQL, permissions, network) becomes a generic error with the original
 *  kept as `cause` for server-side logging. */
export function fromDatabaseError(error: PostgrestLikeError): AppError {
  const message = error.message ?? "";
  if (error.code === "P0001" && isErrorCode(message)) {
    const detail = error.details ?? undefined;
    const retry = message === "RATE_LIMITED" && detail ? Number.parseInt(detail, 10) : undefined;
    return new AppError(message, {
      detail: message === "RATE_LIMITED" ? undefined : detail,
      retryAfterSeconds: Number.isFinite(retry) ? retry : undefined,
      cause: error,
    });
  }
  // 42501 insufficient_privilege and RLS WITH CHECK failures.
  if (error.code === "42501") {
    return new AppError("FORBIDDEN", { cause: error });
  }
  return new AppError("INTERNAL", { cause: error });
}
