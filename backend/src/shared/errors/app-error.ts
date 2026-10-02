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

/**
 * The caller is authenticated but not allowed to perform this action (Unit 03: a
 * logged-in judge or player calling a controller-only endpoint). Distinct from
 * `UnauthorizedError`, which means no valid session at all.
 */
export class ForbiddenError extends AppError {
  constructor(
    message = "Forbidden",
    options: { code?: string; details?: unknown } = {},
  ) {
    super(message, {
      statusCode: 403,
      code: options.code ?? "FORBIDDEN",
      details: options.details,
    });
  }
}

/**
 * The request conflicts with the resource's current state (Unit 03: editing the
 * structure of an already-published competition).
 */
export class ConflictError extends AppError {
  constructor(
    message = "Conflict",
    options: { code?: string; details?: unknown } = {},
  ) {
    super(message, {
      statusCode: 409,
      code: options.code ?? "CONFLICT",
      details: options.details,
    });
  }
}

/**
 * The request is well-formed but cannot be processed against the current state
 * (Unit 03: publishing while readiness conditions are unmet — the spec's contract
 * returns `422` with the list of unmet conditions).
 */
export class UnprocessableEntityError extends AppError {
  constructor(
    message = "Unprocessable entity",
    options: { code?: string; details?: unknown } = {},
  ) {
    super(message, {
      statusCode: 422,
      code: options.code ?? "UNPROCESSABLE_ENTITY",
      details: options.details,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, { statusCode: 400, code: "VALIDATION_ERROR", details });
  }
}
