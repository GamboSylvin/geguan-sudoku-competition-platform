import { en, type MessageCatalogue } from "./en";
import { zh } from "./zh";

/**
 * i18n scaffold (ARCH-026, Unit 01 acceptance criterion 5). English and Chinese
 * are the only locales; a third language is OPEN (U-51) and is not set up.
 * `translate` walks a dot-path and returns the key itself when a translation is
 * missing, so a gap is visible rather than silently empty.
 */
export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
/**
 * Chinese is the default locale (U-68, BLD-053): the event's students, judges and
 * audience are in mainland China. English stays available through the language
 * switcher, and a choice saved in `localStorage` overrides this default.
 */
export const DEFAULT_LOCALE: Locale = "zh";

export const catalogues: Record<Locale, MessageCatalogue> = { en, zh };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function translate(locale: Locale, key: string): string {
  const parts = key.split(".");
  let current: unknown = catalogues[locale];
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}
