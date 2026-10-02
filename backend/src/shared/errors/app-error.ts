/**
 * Application error with an HTTP status and a machine-readable code. The error
 * shape is still OPEN in code-standards, so this stays minimal and easy to change.
 * User-facing messages must exist in both English and Chinese (ARCH-026); the
 * message catalogue lives in `shared/i18n`.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    options: { statusCode?: number; code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", details?: unknown) {
    super(message, { statusCode: 404, code: "NOT_FOUND", details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = "Not authenticated",
    options: { code?: string; details?: unknown } = {},
  ) {
    super(message, {
      statusCode: 401,
      code: options.code ?? "UNAUTHORIZED",
      details: options.details,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, { statusCode: 400, code: "VALIDATION_ERROR", details });
  }
}
