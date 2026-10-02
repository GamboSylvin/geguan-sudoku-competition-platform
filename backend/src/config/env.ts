import "dotenv/config";
import { z } from "zod";

/**
 * Read and validate the environment. Fail fast on a missing variable:
 * a silent default for a secret is worse than a clear crash at startup
 * (spec 01-foundation, "Error Cases"; code-standards, "Forbidden practices").
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  BACKEND_PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),

  // The single server clock decides every timing question (architecture.md, Data flow).
  TZ: z.string().default("Asia/Shanghai"),

  // PostgreSQL (durable data). DATABASE_URL is what Prisma reads (I-31).
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis (runtime state, persistence on — BLD-007).
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // File storage (BLD-001).
  STORAGE_ROOT: z.string().default("./storage"),

  // Session length: a fixed window from login, never refreshed on activity
  // (AUTH-001). Kept configurable so the event day's needs can be tuned without a
  // code change; the default is the decided 24 hours.
  SESSION_TTL_HOURS: z.coerce.number().positive().default(24),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // Fail fast with a clear message; do not start with an invalid environment.
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
