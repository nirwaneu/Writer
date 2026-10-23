export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CONFIG_REQUIRED"
  | "SESSION_UNAVAILABLE"
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH"
  | "AI_RATE_LIMIT"
  | "AI_UNAVAILABLE"
  | "AI_BAD_RESPONSE"
  | "AI_TIMEOUT"
  | "STORAGE_CORRUPT"
  | "STORAGE_IO"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: { status?: number; retryable?: boolean; details?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? statusForCode(code);
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

function statusForCode(code: ErrorCode): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "CONFIG_REQUIRED":
    case "AI_NOT_CONFIGURED":
      return 428;
    case "SESSION_UNAVAILABLE":
      return 500;
    case "AI_AUTH":
      return 502;
    case "AI_RATE_LIMIT":
      return 429;
    case "AI_TIMEOUT":
      return 504;
    case "AI_UNAVAILABLE":
    case "AI_BAD_RESPONSE":
      return 502;
    case "STORAGE_CORRUPT":
    case "STORAGE_IO":
    case "INTERNAL":
      return 500;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("NOT_FOUND", message, { status: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, { status: 409, details });
  }
}

export class StorageError extends AppError {
  constructor(message: string, code: "STORAGE_CORRUPT" | "STORAGE_IO" = "STORAGE_IO", cause?: unknown) {
    super(code, message, { cause });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}
