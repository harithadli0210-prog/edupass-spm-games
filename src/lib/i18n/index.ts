import { en, type Dictionary } from "./en";
import { ms } from "./ms";
import { DEFAULT_LOCALE, type Locale } from "./config";

export * from "./config";
export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { en, ms };

/**
 * Both dictionaries are plain objects imported at build time rather than
 * dynamic imports. They are a few KB, the app renders on the server, and a
 * synchronous lookup keeps every page and component free of await-for-copy.
 */
export function getDictionary(lang: Locale): Dictionary {
  return DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * Fill {placeholders} in a string.
 *
 *   t("{days} days left", { days: 39 })  →  "39 days left"
 *
 * Deliberately minimal: no plural rules, no ICU. Malay does not inflect for
 * plurals, and the handful of English strings that need it are written to work
 * either way ("39 days left", "1 days left" never occurs because the one-day
 * case has its own key).
 */
export function t(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

/** Locale-aware number formatting — grouping differs between en-MY and ms-MY. */
export function formatNumber(lang: Locale, value: number): string {
  return new Intl.NumberFormat(lang === "ms" ? "ms-MY" : "en-MY").format(
    Math.round(value),
  );
}
