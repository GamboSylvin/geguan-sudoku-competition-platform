/**
 * The one logger for the backend. It lives in `infra/` because it is an adapter to
 * the outside world and holds no domain rule. Kept deliberately small in Unit 01;
 * it is the single place failures are reported from (code-standards, Error handling:
 * never swallow errors silently).
 */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: unknown): void {
  const line = {
    at: new Date().toISOString(),
    level,
    message,
    ...(meta !== undefined ? { meta } : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === "error" || level === "warn") {
    process.stderr.write(`${serialized}\n`);
  } else {
    process.stdout.write(`${serialized}\n`);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => emit("debug", message, meta),
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta),
};
