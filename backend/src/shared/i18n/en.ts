/**
 * English message catalogue. The interface is bilingual, English and Chinese
 * (ARCH-026); the translation mechanism is planned in from the start.
 * Only the keys the skeleton needs exist here; each screen adds its own strings.
 */
export const en = {
  common: {
    ok: "OK",
    notFound: "Not found",
    validationFailed: "Validation failed",
    internalError: "Internal server error",
  },
  health: {
    healthy: "Healthy",
    unhealthy: "Unhealthy",
    database: "Database",
    redis: "Redis",
  },
} as const;

/** Recursively widens the literal `en` catalogue to `string` leaves, keeping its shape. */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type MessageCatalogue = DeepString<typeof en>;
