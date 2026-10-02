/**
 * Vite build-time environment (Unit 02). `import.meta.env` is Vite-only syntax and
 * cannot be parsed by the CommonJS test transform, so the rest of the app imports a
 * plain constant from here and Jest maps this module to `tests/env-mock.cjs`.
 * A relative import would defeat the mapping, so callers use the `@/config/env` alias.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:3000";
