import { en, type MessageCatalogue } from "./en";
import { zh } from "./zh";

/**
 * English and Chinese are the only locales (ARCH-026). How the language is chosen
 * (per user, per event, or both shown at once) is still OPEN (U-68), so this
 * scaffold exposes the catalogues and a lookup by locale without deciding that.
 * A third language is OPEN (U-51) and is not set up.
 */
export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const catalogues: Record<Locale, MessageCatalogue> = { en, zh };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve a dot-separated key (for example `health.database`) in the given locale.
 * Returns the key itself if it is missing, so a missing string is visible rather
 * than silently empty.
 */
export function translate(locale: Locale, key: string): string {
  const catalogue = catalogues[locale] ?? catalogues[DEFAULT_LOCALE];
  const parts = key.split(".");
  let node: unknown = catalogue;
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      return key;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}

export type { MessageCatalogue };
