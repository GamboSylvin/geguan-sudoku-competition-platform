import { z } from "zod";
import { ValidationError } from "../errors/app-error";

/**
 * Validate unknown external input at the system boundary before trusting it
 * (code-standards, Language: the client is never trusted). Modules call this in
 * their controller before the service runs.
 */
export function parseInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid input", result.error.flatten());
  }
  return result.data;
}
